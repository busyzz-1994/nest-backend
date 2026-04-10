import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StreamingService } from './streaming.service';

/**
 * 流式响应示例控制器
 *
 * 演示两种流式传输方式:
 * 1. SSE (Server-Sent Events) — 基于 HTTP 的单向实时推送协议
 * 2. ReadableStream — 使用 Transfer-Encoding: chunked 的原始流式响应
 */
@Controller('streaming')
export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

  // ============================================================
  //  方式一: Server-Sent Events (SSE)
  // ============================================================
  //
  //  原理:
  //  - 基于 HTTP 长连接，Content-Type 为 text/event-stream
  //  - 服务端可以持续推送事件，客户端通过 EventSource API 接收
  //  - 每条消息格式为:  data: <内容>\n\n
  //  - 天然支持自动重连、事件 ID、事件类型等功能
  //
  //  NestJS 内置支持:
  //  - 使用 @Sse() 装饰器，返回 Observable<MessageEvent>
  //  - NestJS 自动设置正确的响应头和格式
  //  - 但全局 TransformInterceptor 会包装 Observable 中的每个值，
  //    导致 SSE 数据结构被破坏，因此这里使用 @Res() 手动写入 SSE 格式
  //
  //  客户端使用:
  //  ```js
  //  const source = new EventSource('/api/streaming/sse?prompt=你好');
  //  source.onmessage = (event) => {
  //    console.log(event.data); // 每次收到一个 token
  //  };
  //  source.addEventListener('done', () => {
  //    source.close(); // 收到 done 事件后关闭连接
  //  });
  //  ```
  // ============================================================

  @Get('sse')
  async streamSSE(
    @Query('prompt') prompt: string = '你好',
    @Res() res: Response,
  ): Promise<void> {
    // 手动设置 SSE 响应头（绕过 TransformInterceptor）
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const token of this.streamingService.generateTokens(prompt)) {
        // SSE 协议格式: data: <json>\n\n
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
      // 发送完成事件
      res.write(`event: done\ndata: ${JSON.stringify({ done: true })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ error: 'SSE 流生成失败' })}\n\n`);
    } finally {
      res.end();
    }
  }

  // ============================================================
  //  方式二: ReadableStream / Chunked Transfer
  // ============================================================
  //
  //  原理:
  //  - 使用 Transfer-Encoding: chunked，服务端逐块写入响应体
  //  - 不依赖特定协议，任何 HTTP 客户端都能消费
  //  - 适用于需要自定义格式的场景（如 OpenAI 的 streaming API）
  //
  //  服务端实现:
  //  - 直接操作 Express 的 Response 对象 (res.write / res.end)
  //  - 使用 @Res() 注入原始 response，绕过 NestJS 的拦截器
  //
  //  客户端使用 (Fetch + ReadableStream):
  //  ```js
  //  const response = await fetch('/api/streaming/readable?prompt=你好');
  //  const reader = response.body.getReader();
  //  const decoder = new TextDecoder();
  //
  //  while (true) {
  //    const { done, value } = await reader.read();
  //    if (done) break;
  //    const chunk = decoder.decode(value, { stream: true });
  //    console.log(chunk); // 逐块输出
  //  }
  //  ```
  // ============================================================

  @Get('readable')
  async streamReadable(
    @Query('prompt') prompt: string = '你好',
    @Res() res: Response,
  ): Promise<void> {
    // 设置响应头，表明这是一个流式响应
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const token of this.streamingService.generateTokens(prompt)) {
        // 逐块写入响应体 — 客户端的 ReadableStream 会逐步收到这些数据
        res.write(token);
      }
    } catch {
      res.write('\n[错误] 流生成失败');
    } finally {
      res.end(); // 结束响应
    }
  }
}
