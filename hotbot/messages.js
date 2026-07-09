const PT = {
  pixNotConfigured: "\n\n[PIX NÃO CONFIGURADO — configure a chave Pix no painel da instância.]",
  pixHeader: "\n\n--- DADOS REAIS DO PAINEL (OBRIGATÓRIO) ---\nChave PIX:",
  pixRecipient: "Nome do recebedor:",
  pixWhenPay: "Quando o lead quiser pagar, use EXATAMENTE a chave acima ou a tag [[send_chave_pix]].",
  pixNeverPlaceholder: 'NUNCA escreva [sua_chave_pix], {chave_pix} ou "chave do painel".',
  priceTableTitle: "💎 *MEUS PACOTES* 💎",
  priceTableAsk: "Qual pacote te interessa, amor? 💕",
  videoCallTitle: "📹 *CHAMADA DE VÍDEO* 📹",
  videoCallDefault: "1️⃣ *CHAMADA VÍDEO* - R$ 15,00",
  videoCallDefaultSub: "   📹 5 min no zap",
  videoCallAsk: "Qual você quer, amor? 💕",
  videoCallDuration: "(5 min no zap)",
  receiptProof: "Para comprovante, manda imagem ou PDF, tá?",
  audioConfused: "Não entendi direito amor, pode repetir ou escrever?",
  deliveryError:
    "Amor, confirmou o pagamento mas deu um probleminha na entrega. Me chama que eu mando manual 💕",
  videoCallDelayFallback:
    "prontinho amor 😘 daqui 10 minutinhos eu te mando o link pra entrar na chamada, tá?",
  videoCallLinkFallback: "prontinho amor, é só entrar na chamada 😘",
  deliveryIntroFallback: "Aqui está seu acesso amor, aproveite 😘",
  basicPackDelivery: "Aqui estão suas 50 fotos e vídeos amor, aproveite 😘",
  currencySymbol: "R$",
  whisperLang: "pt"
};

const EN = {
  pixNotConfigured: "\n\n[PIX NOT CONFIGURED — set your Pix key in the instance panel.]",
  pixHeader: "\n\n--- REAL PANEL DATA (MANDATORY) ---\nPIX key:",
  pixRecipient: "Recipient name:",
  pixWhenPay: "When the lead wants to pay, use EXACTLY the key above or the [[send_chave_pix]] tag.",
  pixNeverPlaceholder: 'NEVER write [your_pix_key], {pix_key} or "panel key".',
  priceTableTitle: "💎 *MY PACKS* 💎",
  priceTableAsk: "Which pack do you want, babe? 💕",
  videoCallTitle: "📹 *VIDEO CALL* 📹",
  videoCallDefault: "1️⃣ *VIDEO CALL* - $15.00",
  videoCallDefaultSub: "   📹 5 min on WhatsApp",
  videoCallAsk: "Which one do you want, babe? 💕",
  videoCallDuration: "(5 min on WhatsApp)",
  receiptProof: "For payment proof, send an image or PDF, okay?",
  audioConfused: "I didn't quite get that babe, can you repeat or type it?",
  deliveryError:
    "Babe, payment went through but there was a small delivery issue. Message me and I'll send it manually 💕",
  videoCallDelayFallback:
    "all set babe 😘 I'll send you the call link in about 10 minutes, okay?",
  videoCallLinkFallback: "here you go babe, just join the call 😘",
  deliveryIntroFallback: "Here's your access babe, enjoy 😘",
  basicPackDelivery: "Here are your 50 photos and videos babe, enjoy 😘",
  currencySymbol: "$",
  whisperLang: "en"
};

function getBotMessages(locale) {
  return locale === "en-US" ? EN : PT;
}

function formatMoney(cents, locale) {
  const m = getBotMessages(locale);
  const value = (Number(cents || 0) / 100).toFixed(2);
  if (locale === "en-US") return `${m.currencySymbol}${value}`;
  return `${m.currencySymbol} ${value.replace(".", ",")}`;
}

module.exports = { getBotMessages, formatMoney, PT, EN };
