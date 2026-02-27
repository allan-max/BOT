const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const http = require('http');
const https = require('https');
const fs = require('fs');
const util = require('util');
const path = require('path');

// ======================================================================
// SISTEMA DE LOGS DEFINITIVO (CAPTURA 100% DO CMD)
// ======================================================================
const PASTA_DO_LOG = '\\\\SERVIDOR2\\Publico\\ALLAN\\Logs'; 
const arquivoLog = path.join(PASTA_DO_LOG, 'log_zapzap.txt');

try {
    if (!fs.existsSync(PASTA_DO_LOG)) {
        fs.mkdirSync(PASTA_DO_LOG, { recursive: true });
    }
} catch (e) {
    // Se der erro, cai no fluxo normal do terminal
}

const streamDeLog = fs.createWriteStream(arquivoLog, { flags: 'a' });

// Bibliotecas como o WPPConnect usam textos coloridos no CMD. 
// Essa função limpa os códigos de cor para o Bloco de Notas não ficar cheio de símbolos estranhos (ex: [32m).
function limparCoresTerminal(texto) {
    return texto.toString().replace(/\x1B\[[0-9;]*m/g, '');
}

// 1. Intercepta a saída principal do Node (Captura WPPConnect, Axios, Express, etc)
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk, encoding, callback) {
    if (streamDeLog.writable) {
        streamDeLog.write(limparCoresTerminal(chunk));
    }
    // Continua mandando para a tela do CMD normalmente
    return originalStdoutWrite(chunk, encoding, callback);
};

// 2. Intercepta a saída de erros críticos
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = function(chunk, encoding, callback) {
    if (streamDeLog.writable) {
        streamDeLog.write(limparCoresTerminal(chunk));
    }
    return originalStderrWrite(chunk, encoding, callback);
};

// 3. Adiciona Data e Hora aos seus próprios console.log do código
const logNativo = console.log;
console.log = function (...args) {
    const dataHora = new Date().toLocaleString('pt-BR');
    logNativo(`[${dataHora}]`, ...args);
};

const errorNativo = console.error;
console.error = function (...args) {
    const dataHora = new Date().toLocaleString('pt-BR');
    errorNativo(`[${dataHora}] ERRO:`, ...args);
};

// CONFIGURAÇÃO
// ======================================================================
const PORTA_SERVIDOR = 3000;
const API_GATEWAY = 'http://localhost:5000/api/gateway/tarefa'; 
const MEU_IP_CALLBACK = 'http://localhost'; 

const NOME_GRUPO_PERMITIDO = 'CADASTRO VENTURA';
const NOME_GRUPO_DATASHEET = 'DATASHEET VENTURA';

// ======================================================================
// MEMÓRIA
// ======================================================================
let tarefasEmAndamento = new Map(); 
let clienteWpp = null;
let horaInicializacao = Date.now();
let usuariosAutorizados = new Set();

// ======================================================================
// CLASSES (Módulos de Texto)
// ======================================================================
class ExtratorDatasheet {
    constructor() {
        this.sitesSuportados = {
            'MERCADO_LIVRE': { padroes: [/mercadolivre\.com\.br/, /mercadolivre\.com/, /ml\.com/] },
            'MAGAZINE_LUIZA': { padroes: [/magazineluiza\.com\.br/, /magazinevoce\.com\.br/] },
            'AMAZON': { padroes: [/amazon\.com\.br/, /amzn\.to/] },
            'FUJIOKA': { padroes: [/fujioka\.com\.br/, /fujiokadistribuidor\.com\.br/] },
            'FRIOPECAS': { padroes: [/friopecas\.com\.br/] },
            'agis': { padroes: [/vendas.agis\.com\.br/, /agis\.com\.br/] },
            'vonder': { padroes: [/vonder\.com\.br/] },
            'MAZER': { padroes: [/mazer\.com\.br/] },
            'SAMSUNG': { padroes: [/samsung\.com/] },
            'compregolden': { padroes: [/compregolden\.com\.br/,/compregolden\.com/ ] },
            'DUTRA': { padroes: [/dutramaquinas\.com\.br/] },
            'ROUTE66': { padroes: [/route66\.com\.br/] },
            'KABUM' : { padroes: [/kabum\.com\.br/]},
            'ATACADOSP': { padroes: [/atacadosaopaulo\.com\.br/,/ atacadosaopaulo\.com/ ]},
            'MARTINS': { padroes: [/martinsatacado\.com\.br/] },
            'LOJADOMECANICO': { padroes: [/lojadomecanico\.com\.br/] },
            'MAGALU': { padroes: [/magazineluiza\.com\.br/, /magalu\.com/] },
            'MAGALUEMPRESAS': { padroes: [/magaluempresas\.com\.br/] },
            'intelbras': { padroes: [/intelbras\.com/] },
            'BHPHOTOVIDEO': { padroes: [/bhphotovideo\.com/] },
            'dell': { padroes: [/dell\.com\.br/, /dell\.com/] },
            'kalunga': { padroes: [/kalunga\.com\.br/] },
            'pauta': { padroes: [/pauta\.com\.br/] },
            'ingram': { padroes: [/ingrammicro\.com\.br/] },
            'tambasa': { padroes: [/tambasa\.com\.br/, /loja\.tambasa\.com/] },
            'frigelar': { padroes: [/frigelar\.com\.br/] },
            'fastshop': { padroes: [/fastshop\.com\.br/, /site\.fastshop\.com/] },
            'ordeco': { padroes: [/oderco\.com\.br/] },
            'quasetudo': { padroes: [/quasetudodeinformatica\.com\.br/] },
            'kalunga': { padroes: [/kalunga\.com\.br/] },
            'dimensional': { padroes: [/dimensional\.com\.br/] },
            'hayamax': { padroes: [/hayamax\.com\.br/] },
            'WEG': { padroes: [/weg\.net/] }
        };
    }
    analisarMensagem(texto) {
        const urls = [];
        const matches = texto.match(/(https?:\/\/[^\s]+)/g) || [];
        for (const url of matches) {
            urls.push(this.analisarURL(url.trim().replace(/[.,;!?)]+$/, '')));
        }
        return urls;
    }
    analisarURL(url) {
        const resultado = { url: url, site: null, suportado: false };
        for (const [site, config] of Object.entries(this.sitesSuportados)) {
            if (config.padroes.some(p => p.test(url))) { resultado.site = site; resultado.suportado = true; break; }
        }
        return resultado;
    }
}
class ValidadorDatasheet {
    validarURLs(urls) {
        const sup = urls.filter(u => u.suportado);
        return { aprovado: sup.length > 0, urlsSuportadas: sup };
    }
}

let extrator, validadorProduto, extratorFornecedor, validadorFornecedor, gerenciadorContexto;
try {
    const modProdutos = require('./extrator-produtos');
    extrator = new modProdutos.ExtratorSimples();
    validadorProduto = new modProdutos.ValidadorProduto();
    const modFornecedores = require('./extrator-fornecedores');
    extratorFornecedor = new modFornecedores.ExtratorFornecedor();
    validadorFornecedor = new modFornecedores.ValidadorFornecedor();
    const modContexto = require('./contexto');
    gerenciadorContexto = new modContexto.GerenciadorContextoSilencioso();
} catch (e) {
    extrator = { analisarMensagem: () => [] };
    validadorProduto = { validarProduto: () => ({ aprovado: false }) };
    extratorFornecedor = { analisarMensagem: () => ({}) };
    validadorFornecedor = { validarFornecedor: () => ({ aprovado: false }) };
    gerenciadorContexto = { getContexto: () => ({ getUltimoFornecedorPendente: () => null, adicionarProdutoPendente: () => {}, completarUltimoProdutoPendenteComPreco: () => {} }) };
}
const extratorDatasheet = new ExtratorDatasheet();
const validadorDatasheet = new ValidadorDatasheet();

// ======================================================================
// ENVIO PARA GATEWAY 
// ======================================================================
async function enviarParaGateway(dadosOriginais) {
    const customId = dadosOriginais.custom_id || uuidv4();
    const webhookUrl = `${MEU_IP_CALLBACK}:${PORTA_SERVIDOR}/api/datasheet/webhook`;
    const tipo = dadosOriginais.tipo ? dadosOriginais.tipo.toUpperCase() : 'TAREFA';

    let dadosPayload = {};
    switch (tipo) {
        case 'PRODUTO':
            dadosPayload = {
                ncm: dadosOriginais.ncm,
                custo: parseFloat(dadosOriginais.preco), 
                descricao: dadosOriginais.descricao, 
                webhook_url: webhookUrl
            };
            break;
        case 'CLIENTE':
            dadosPayload = {
                cnpj: dadosOriginais.cnpj,
                inscricaoEstadual: dadosOriginais.inscricaoEstadual || "",
                webhook_url: webhookUrl
            };
            break;
        case 'FORNECEDOR':
            dadosPayload = { cnpj: dadosOriginais.cnpj, webhook_url: webhookUrl };
            break;
        case 'DATASHEET':
            dadosPayload = { url: dadosOriginais.url, webhook_url: webhookUrl };
            break;
        default:
            dadosPayload = { ...dadosOriginais, webhook_url: webhookUrl };
    }

    const payloadFinal = {
        codigoTarefa: customId,
        tipoTarefa: tipo,
        dados: dadosPayload
    };

    console.log(`📤 [GATEWAY] Enviando Payload (${tipo}):`, JSON.stringify(payloadFinal, null, 2));

    const configAxios = {
        timeout: 2000000,
        headers: { 'Content-Type': 'application/json' },
        proxy: false,
        httpAgent: new http.Agent({ keepAlive: true, family: 4 }),
        httpsAgent: new https.Agent({ keepAlive: true, family: 4 })
    };

    try {
        const resposta = await axios.post(API_GATEWAY, payloadFinal, configAxios);
        console.log(`✅ [GATEWAY] Status: ${resposta.status}`);
        
        if (resposta.data) {
             console.log(`📦 [DADOS INTERNOS]`, JSON.stringify(resposta.data, null, 2));
        }

        let resultadoImediato = null;
        
        // Verifica se veio resposta imediata do C#
        if (resposta.data && resposta.data.respostaServico) {
            try {
                const dadosServico = JSON.parse(resposta.data.respostaServico);
                
                // --- CORREÇÃO AQUI: ADICIONADOS codigoCliente E codigoFornecedor ---
                resultadoImediato = dadosServico.codigoProduto || 
                                    dadosServico.codigoCliente || 
                                    dadosServico.codigoFornecedor || 
                                    dadosServico.codigo || 
                                    dadosServico.id || 
                                    dadosServico.Id;
            } catch (e) {
                console.error("Erro ao ler JSON interno:", e);
            }
        }

        return { 
            sucesso: true, 
            id: customId, 
            resultadoImediato: resultadoImediato 
        };

    } catch (error) {
        console.error(`❌ [ERRO] Falha ao enviar para API: ${error.message}`);
        return { sucesso: false, erro: error.message };
    }
}

// ======================================================================
// WEBHOOK 
// ======================================================================
const app = express();
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.post('/api/datasheet/webhook', async (req, res) => {
    try {
        const body = req.body || {};
        const idInterno = body.codigoTarefa || body.request_id || body.custom_id || body.id_interno;
        
        if (idInterno) {
            const tarefa = tarefasEmAndamento.get(idInterno);
            if (tarefa && clienteWpp) {
                const { msgId, usuario, grupo, tipo } = tarefa;
                const destino = grupo || usuario;
                
                let msgResposta = "";

                if (tipo === 'datasheet') {
                    msgResposta = "feito";
                } else {
                    // --- CORREÇÃO AQUI TAMBÉM: ADICIONADOS OS CAMPOS FALTANTES ---
                    const codigo = body.codigoProduto || 
                                   body.codigoCliente || 
                                   body.codigoFornecedor || 
                                   body.codigo || 
                                   body.Codigo || 
                                   body.id || 
                                   body.resultado;
                    
                    if (typeof codigo === 'object') {
                        msgResposta = body.mensagem || "Feito";
                    } else {
                        msgResposta = codigo ? String(codigo) : (body.mensagem || "Feito");
                    }
                }

                await clienteWpp.reply(destino, msgResposta, msgId);
                console.log(`✅ Respondido via Webhook: "${msgResposta}"`);
                
                tarefasEmAndamento.delete(idInterno);
            }
        }
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});
app.listen(PORTA_SERVIDOR, () => console.log(`🚀 Webhook na porta ${PORTA_SERVIDOR}`));

// ======================================================================
// BOT WHATSAPP
// ======================================================================
wppconnect.create({
    session: 'bot-servidor',
    headless: 'new',
    logQR: true,
    disableWelcome: true,
    browserArgs: ['--no-sandbox', '--disable-setuid-sandbox']
}).then((client) => {
    clienteWpp = client;
    horaInicializacao = Date.now();
    start(client);
}).catch(err => console.error('Erro WPP:', err));

async function start(client) {
    console.log('🤖 BOT ONLINE - MODO DEBUG TOTAL (SEM FILTROS)');

    // ======================================================================
    // 🔥 ESCUDO DEFINITIVO V2 (RECURSIVO) ANTI-[object Object]
    // ======================================================================
    const extrairSeguro = (obj) => {
        // 1. Se for nulo ou vazio, ignora
        if (!obj) return null;
        
        // 2. Se já for o texto certinho, retorna (e ignora se for a string literal "[object Object]")
        if (typeof obj === 'string') {
            return obj === '[object Object]' ? null : obj;
        }
        
        // 3. Se for um objeto, vamos cavar até achar a string
        if (typeof obj === 'object') {
            if (obj._serialized && typeof obj._serialized === 'string') {
                return obj._serialized;
            }
            
            // Aqui está o pulo do gato: se o .id for OUTRO objeto, a função chama ela mesma de novo!
            if (obj.id) {
                return extrairSeguro(obj.id); 
            }
        }
        
        return String(obj);
    };

    // Blinda a função de Responder (Reply)
    const originalReply = client.reply.bind(client);
    client.reply = async function(to, content, quotedMsg) {
        return originalReply(extrairSeguro(to), content, extrairSeguro(quotedMsg));
    };

    // Blinda a função de Reagir com Emoji
    const originalReact = client.sendReactionToMessage.bind(client);
    client.sendReactionToMessage = async function(messageId, reaction) {
        return originalReact(extrairSeguro(messageId), reaction);
    };
    // ======================================================================

    client.onMessage(async (message) => {
        if (message.type !== 'chat') return;

        // ======================================================================
        // 🔥 EXTRAÇÃO SEGURA DEFINITIVA (Lê a mensagem corretamente)
        // ======================================================================
        const extrairIdString = (obj) => {
            if (!obj) return null;
            if (typeof obj === 'string') return obj === '[object Object]' ? null : obj;
            if (typeof obj === 'object') {
                if (obj._serialized && typeof obj._serialized === 'string') return obj._serialized;
                if (obj.id) return extrairIdString(obj.id); // <--- O SEGREDO AQUI (Recursivo)
            }
            const str = String(obj);
            return str === '[object Object]' ? null : str;
        };

        const stringChatId = extrairIdString(message.chatId);
        const stringFrom = extrairIdString(message.from);
        const stringAuthor = extrairIdString(message.author);

        // Verifica se é grupo olhando para as variáveis seguras
        const isGroup = message.isGroupMsg || 
                        (stringChatId && stringChatId.includes('@g.us')) || 
                        (stringFrom && stringFrom.includes('@g.us'));
        
        // Se for grupo, pega o ID do grupo (sempre em texto). Se não, null.
        const grupo = isGroup ? (stringFrom && stringFrom.includes('@g.us') ? stringFrom : stringChatId) : null;
        
        // O autor da mensagem (quem enviou)
        const usuario = stringAuthor || stringFrom;
        
        const msgId = extrairIdString(message.id);

        const texto = (message.body || '').trim();

        // LOG GERAL - VAMOS VER O QUE CHEGA
        console.log('===========================================================');
        console.log(`📩 MENSAGEM RECEBIDA!`);
        console.log(`   Tipo: ${message.type}`);
        console.log(`   De: ${usuario}`);
        console.log(`   Grupo: ${isGroup ? 'SIM (' + grupo + ')' : 'NÃO'}`);
        console.log(`   Texto: "${texto}"`);
        console.log('===========================================================');
        // ============================================================
        // 1. BLOCO DE GRUPOS
        // ============================================================
        if (isGroup) {
            try {
                // Tenta pegar o nome do chat
                const chat = await client.getChatById(grupo);
                
                // Pega o nome do objeto chat OU do objeto message
                const nomeReal = chat.name || message.chat.name || ''; 
                const nomeG = nomeReal.toUpperCase().trim();
                
                console.log(`🔍 [ANALISANDO GRUPO]`);
                console.log(`   Nome lido do WhatsApp: "${nomeReal}"`);
                console.log(`   Nome usado na comparação: "${nomeG}"`);
                console.log(`   Deve conter: "${NOME_GRUPO_PERMITIDO}" ou "${NOME_GRUPO_DATASHEET}"`);

                // A. GRUPO DATASHEET
                if (nomeG.includes(NOME_GRUPO_DATASHEET)) { 
                    console.log('   ✅ GRUPO DATASHEET DETECTADO! Processando...');
                    await processarDatasheet(texto, usuario, grupo, isGroup, msgId); 
                    return; 
                }

                // B. GRUPO CADASTRO
                if (nomeG.includes(NOME_GRUPO_PERMITIDO)) {
                    console.log('   ✅ GRUPO CADASTRO DETECTADO! Analisando conteúdo...');
                    
                    const contexto = gerenciadorContexto.getContexto(grupo);

                    if (deveProcessarComoEntidade(texto)) {
                        console.log('   -> Identificado como Cliente/Fornecedor');
                        await processarEntidade(texto, usuario, grupo, isGroup, msgId);
                        return;
                    }

                    if (deveProcessarComoDatasheet(texto)) { 
                        console.log('   -> Identificado como Link Datasheet');
                        await processarDatasheet(texto, usuario, grupo, isGroup, msgId); 
                        return; 
                    }

                    console.log('   -> Tentando processar como Produto...');
                    await processarProdutos(texto, usuario, grupo, isGroup, msgId, contexto);
                    return; 
                }
                
                console.log('   ⚠️ O nome do grupo não corresponde aos permitidos.');

            } catch (erro) {
                console.error('❌ Erro ao ler dados do grupo:', erro);
            }
            return;
        } 
        
      // ============================================================
        // 2. BLOCO DE PV (MANTIDO E CORRIGIDO)
        // ============================================================
        else {
            console.log('👤 Mensagem no Privado');
            
            // Vamos limpar o texto para facilitar as comparações
            const comando = texto.toLowerCase().trim();

            // A. LOGIN
            if (comando === 'cadaallan') {
                usuariosAutorizados.add(usuario);
                await client.reply(usuario, '✅ Ativado. Modo administrador liberado.', msgId);
                return;
            }

            // B. LOGOUT (SAIR) - ADICIONE ESTE BLOCO AQUI!
            if (['sair', 'fechar', 'deslogar'].includes(comando)) {
                if (usuariosAutorizados.has(usuario)) {
                    usuariosAutorizados.delete(usuario); // Remove da lista
                    await client.reply(usuario, '🔒 Chat fechado. Até logo!', msgId);
                    console.log(`[LOGOUT] Usuário ${usuario} saiu.`);
                } else {
                    await client.reply(usuario, '🔒 Você já não estava logado.', msgId);
                }
                return; // IMPEDE que o código continue e tente ler "sair" como produto
            }

            // C. VERIFICAÇÃO DE SEGURANÇA
            if (!usuariosAutorizados.has(usuario)) {
                console.log('   ⛔ Usuário não logado. Ignorando.');
                return;
            }

            // ... Daqui para baixo só executa se estiver LOGADO ...

            if (deveProcessarComoDatasheet(texto)) { 
                await processarDatasheet(texto, usuario, grupo, isGroup, msgId); 
                return; 
            }
            
            const contexto = gerenciadorContexto.getContexto(usuario);
            
            if (deveProcessarComoEntidade(texto)) {
                await processarEntidade(texto, usuario, grupo, isGroup, msgId);
                return;
            }

            // Se chegou aqui, tenta processar como produto
            await processarProdutos(texto, usuario, grupo, isGroup, msgId, contexto);
        }
    });
}
// Funções Auxiliares
function deveProcessarComoDatasheet(texto) { return validadorDatasheet.validarURLs(extratorDatasheet.analisarMensagem(texto)).aprovado; }
function deveProcessarComoEntidade(texto) { return texto.toUpperCase().includes('FORNECEDOR') || texto.toUpperCase().includes('CLIENTE'); }
async function reagir(msgId) { try { await clienteWpp.sendReactionToMessage(msgId, '⏳'); } catch(e) {} }

// ======================================================================
// PROCESSADORES 
// ======================================================================

async function processarDatasheet(texto, u, g, isG, mId) {
    const validacao = validadorDatasheet.validarURLs(extratorDatasheet.analisarMensagem(texto));
    if (validacao.aprovado) {
        for (const urlInfo of validacao.urlsSuportadas) {
            const id = `ds_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
            await reagir(mId);
            
            tarefasEmAndamento.set(id, { usuario: u, grupo: g, msgId: mId, isGroup: isG, tipo: 'datasheet' });
            
            const res = await enviarParaGateway({ tipo: 'datasheet', url: urlInfo.url, custom_id: id });
            
            if (res.sucesso && res.resultadoImediato) {
                await clienteWpp.reply(isG ? g : u, "feito", mId);
                tarefasEmAndamento.delete(id);
            }
        }
    }
}

async function processarEntidade(texto, u, g, isG, mId) {
    const ent = extratorFornecedor.analisarMensagem(texto);
    if (validadorFornecedor.validarFornecedor(ent).aprovado) {
        const id = `ent_${Date.now()}`;
        const tipo = texto.toUpperCase().includes('CLIENTE') ? 'cliente' : 'fornecedor';
        await reagir(mId);

        tarefasEmAndamento.set(id, { usuario: u, grupo: g, msgId: mId, isGroup: isG, tipo: tipo });
        
        const res = await enviarParaGateway({ ...ent, tipo: tipo, custom_id: id });

        if (res.sucesso && res.resultadoImediato) {
            await clienteWpp.reply(isG ? g : u, String(res.resultadoImediato), mId);
            tarefasEmAndamento.delete(id);
        }
    }
}

// ======================================================================
// PROCESSADOR DE PRODUTOS (PARALELO E AGRUPADO)
// ======================================================================
async function processarProdutos(texto, u, g, isG, mId, ctx) {
    // 1. Extrai todos os produtos da mensagem
    const prods = extrator.analisarMensagem(texto, ctx);
    
    if (!prods || prods.length === 0) return;

    // Reage apenas uma vez no início para indicar processamento
    await reagir(mId);

    const promessasDeEnvio = [];
    const codigosParaResponder = [];

    // 2. Prepara todas as requisições (sem esperar uma por uma)
    for (const p of prods) {
        // Atualização de contexto (mantida)
        if (p.apenasPreco) ctx.completarUltimoProdutoPendenteComPreco(p.apenasPreco);

        // Validação
        if (validadorProduto.validarProduto(p).aprovado) {
            const id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            
            // Registra a tarefa na memória
            tarefasEmAndamento.set(id, { usuario: u, grupo: g, msgId: mId, isGroup: isG, tipo: 'produto' });

            // 🔥 AQUI ESTÁ A MÁGICA: Não usamos 'await' direto no envio.
            // Adicionamos a promessa no array para disparar tudo junto.
            const promessa = enviarParaGateway({
                tipo: 'produto',
                custom_id: id,
                descricao: p.descricao,
                ncm: p.ncm,
                preco: parseFloat(p.preco)
            }).then(res => {
                // Quando a requisição voltar, processamos o resultado individualmente aqui dentro
                if (res.sucesso && res.resultadoImediato) {
                    // Se deu certo e veio código, guarda na lista e remove da memória
                    tarefasEmAndamento.delete(id);
                    return res.resultadoImediato;
                }
                return null;
            });

            promessasDeEnvio.push(promessa);
        }
    }

    // 3. Aguarda TODOS os envios serem finalizados (Paralelismo)
    // O Promise.all espera todos responderem, mas as requisições foram feitas quase simultaneamente.
    const resultados = await Promise.all(promessasDeEnvio);

    // 4. Filtra apenas os códigos válidos que retornaram
    const codigos = resultados.filter(codigo => codigo !== null);

    // 5. Envia UMA ÚNICA mensagem com todos os códigos
    if (codigos.length > 0) {
        // Formata a mensagem: um código por linha ou separado por espaço/vírgula
        // Exemplo: 
        // 12345
        // 12346
        const msgResposta = codigos.join('\n'); 
        
        await clienteWpp.reply(isG ? g : u, msgResposta, mId);
        console.log(`✅ [LOTE] Respondido ${codigos.length} códigos em uma mensagem.`);
    }
}