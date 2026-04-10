import { Injectable } from '@nestjs/common';

/**
 * 模拟 AI 聊天响应的服务
 * 将一段文本拆分成小块，逐步返回，模拟大语言模型的流式输出
 */
@Injectable()
export class StreamingService {
  private readonly sampleText =
    'NestJS 是一个用于构建高效、可靠和可扩展的服务端应用程序的框架。' +
    '它使用渐进式 JavaScript，内置并完全支持 TypeScript，' +
    '结合了 OOP（面向对象编程）、FP（函数式编程）和 FRP（函数式响应式编程）的元素。';

  /**
   * 模拟 AI 逐字生成文本的异步生成器
   * 每次 yield 一个字符，并带有延迟，模拟真实的 LLM 输出
   */
  async *generateTokens(prompt: string): AsyncGenerator<string> {
    // 先 yield 一条提示信息
    yield `收到提问: "${prompt}"\n\n`;

    // 逐字符输出，模拟 token 流
    for (const char of this.sampleText) {
      await this.delay(10); // 模拟生成延迟
      yield char;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
