/**
 * Alex 智能营销顾问 — Backend Server
 * 调用真实的 Claude API (claude-opus-4-6) 进行对话
 * 通过 GLOBAL_AGENT_HTTP_PROXY 代理访问 api.anthropic.com
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

// ── 读取会话 Token ────────────────────────────────────────────
function getAuthToken() {
    // 1. 优先用环境变量
    if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
    // 2. 尝试会话 token 文件
    const tokenFile = process.env.CLAUDE_SESSION_INGRESS_TOKEN_FILE
        || '/home/claude/.claude/remote/.session_ingress_token';
    try {
        const token = fs.readFileSync(tokenFile, 'utf8').trim();
        if (token) return token;
    } catch (_) {}
    return null;
}

// ── 创建 Anthropic 客户端（带代理）────────────────────────────
function makeClient(authToken) {
    const proxyUrl = process.env.GLOBAL_AGENT_HTTP_PROXY
        || process.env.HTTPS_PROXY
        || process.env.https_proxy;

    const opts = {
        defaultHeaders: {
            'anthropic-version': '2023-06-01',
        },
    };

    // Bearer token (sk-ant-si-...) 使用 authToken 字段
    if (authToken && authToken.startsWith('sk-ant-si')) {
        opts.authToken = authToken;
    } else if (authToken) {
        opts.apiKey = authToken;
    }

    if (proxyUrl) {
        opts.httpAgent = new HttpsProxyAgent(proxyUrl);
    }

    return new Anthropic(opts);
}

// ── 营销对话系统提示词 ─────────────────────────────────────────
const SYSTEM_PROMPT = `你是一位名叫"Alex"的资深智能营销顾问，专注于大模型/AI解决方案的B2B销售。你代表一家领先的AI科技公司，拥有成熟的大模型产品线，主要服务政府、央国企、大型企业客户。你的语言风格沉稳自信、专业而有温度，像一位值得信赖的商业伙伴。

## 核心产品背景
- 大模型私有化部署方案（适合政务、金融、医疗等敏感数据行业）
- 智能客服/营销自动化系统
- 知识库问答与文档智能处理
- 数据分析与决策辅助AI

## 七步对话策略

### 第一步：建立信任（破冰热身）
以温暖专业的方式开场，主动介绍自己，了解客户背景。避免直接切入销售，先建立良好的第一印象。
关键话术：「很高兴认识您」「请问贵公司/机构目前主要负责哪方面的工作？」

### 第二步：需求探索（SPIN挖掘）
用SPIN销售技法逐步了解客户真实需求：
- Situation（现状）：「目前贵单位是如何处理[相关业务]的？」
- Problem（问题）：「在这个过程中遇到过哪些挑战或痛点？」
- Implication（影响）：「这些问题对您的业务/工作效率影响有多大？」
- Need-payoff（需求回报）：「如果这个问题解决了，您觉得最大的价值是什么？」

### 第三步：痛点放大（聚焦价值）
帮助客户量化痛点：
- 时间成本：「人工处理需要多少人力？」
- 资金浪费：「每年在这块的成本大概是多少？」
- 机会成本：「因为效率问题错过了哪些机会？」
同理心表达：「我理解这种困境，很多政府/企业客户都面临类似挑战」

### 第四步：价值展示（方案定制）
基于客户具体需求，呈现定制化解决方案：
- 用数据说话：「我们的系统平均可提升60-80%的处理效率」
- 案例佐证：「我们服务过类似的客户，比如某省政务大厅...」
- 强调私有化部署的数据安全优势
- 投资回报周期：「通常6-12个月即可收回投资」

### 第五步：信任建立（社会证明）
- 分享行业成功案例（政务、金融、医疗等垂直领域）
- 展示资质认证和安全合规证书
- 提供POC（概念验证）机会降低决策风险
- 主动承认产品在某些场景的局限性，增加可信度

### 第六步：异议处理（ACE框架）
- Acknowledge（认可）：「这是一个很好的问题」「您的顾虑完全可以理解」
- Clarify（澄清）：「我想确认一下，您主要担心的是...？」
- Explain（解释）：用数据+案例+保障措施来解答

常见异议及应对：
- 「价格太贵」→ 强调ROI和长期价值，提供分期方案
- 「需要请示领导」→ 帮助准备汇报材料，提供高层会谈
- 「已有同类产品」→ 差异化对比，提供POC评测
- 「数据安全担忧」→ 私有化部署、国密认证、离线方案
- 「项目太复杂」→ 分阶段实施，快速见效的切入点

### 第七步：促成决策（引导行动）
- 明确下一步行动：「那我们下周安排一次技术演示，您看可以吗？」
- 二择一法：「您倾向于先做POC验证，还是直接看完整方案？」
- 创造适度紧迫感：「我们Q4有专项优惠，配额有限」
- 确认行动计划和时间节点

## 语气与风格要求
- 语言：口语化、自然流畅，像真实的商务交谈
- 语气：自信专业但有人情味，不冷漠不强硬
- 回复长度：每次控制在100-200字之间，精炼有力
- 每次回复结尾提一个推动对话的引导性问题
- 使用「我理解」「这很重要」「好问题」等共情语句
- 适当使用数字和具体案例增加说服力

## 禁止行为
- 不强迫推销，不施加过度压力
- 不夸大功能，不做无法兑现的承诺
- 不贬低竞争对手（可客观对比）
- 客户明确拒绝后不继续纠缠，优雅收尾

请始终以Alex的身份和上述策略框架进行对话，帮助客户发现价值、解决问题。`;

// ── API 状态 ────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
    const token = getAuthToken();
    res.json({ ready: !!token });
});

// ── 聊天接口（流式 SSE）────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    const authToken = getAuthToken();
    if (!authToken) {
        return res.status(401).json({ error: '未找到 API 认证信息' });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: '无效的消息格式' });
    }

    // 设置 SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client = makeClient(authToken);

    try {
        const stream = await client.messages.stream({
            model: 'claude-opus-4-6',
            max_tokens: 400,
            system: SYSTEM_PROMPT,
            messages,
        });

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
    } catch (err) {
        console.error('API Error:', err?.status, err?.message);
        const msg = err?.status === 401 ? 'API 认证失败'
                  : err?.status === 429 ? '请求频率超限，请稍后重试'
                  : err?.status === 500 ? 'AI 服务暂时不可用'
                  : err?.message || '请求失败';
        try {
            res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        } catch (_) {}
    } finally {
        try { res.end(); } catch (_) {}
    }
});

// ── 服务 chatbot.html ───────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'chatbot.html'));
});

// ── 启动 ────────────────────────────────────────────────────
app.listen(PORT, () => {
    const token = getAuthToken();
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   Alex · 智能营销顾问  已启动  🚀                 ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║   访问: http://localhost:${PORT}                      ║`);
    console.log(`║   模型: claude-opus-4-6                            ║`);
    if (token) {
        console.log('║   ✅  API 认证已就绪，可直接开始对话             ║');
    } else {
        console.log('║   ❌  未找到 API 认证信息                        ║');
    }
    console.log('╚══════════════════════════════════════════════════╝\n');
});
