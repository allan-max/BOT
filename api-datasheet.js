// api-datasheet.js
const axios = require('axios');

class ApiDatasheet {
    constructor() {
        this.baseURL = process.env.API_DATASHEET_URL || 'http://localhost:5000';
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Bot-WhatsApp-Datasheet/1.0'
            }
        });
        
        this.pedidosPendentes = new Map();
    }
    
    /**
     * Envia a URL para o robô incluindo o campo custom_id solicitado
     */
    async enviarURL(url, dadosMensagem) {
        // Geramos o ID personalizado que o robô deve processar e devolver
        const customId = 'pedido_' + Date.now();
        
        const dadosParaApi = {
            url: url,
            webhook_url: `http://localhost:5000/api/datasheet/webhook`,
            custom_id: customId  // <-- CAMPO ADICIONADO CONFORME SOLICITADO
        };
        
        try {
            console.log(`📤 Enviando para API Python com custom_id: ${customId}`);
            const resposta = await this.client.post('/api/datasheet/processar', dadosParaApi);
            
            /**
             * SINCRONIZAÇÃO:
             * Usamos o customId que nós mesmos criamos para salvar na memória.
             * Se a API devolver um ID diferente na resposta, priorizamos o da resposta.
             */
            const pedidoIdFinal = resposta.data.request_id || resposta.data.custom_id || customId;
            
            this.pedidosPendentes.set(pedidoIdFinal, {
                ...dadosMensagem,
                enviado_em: Date.now(),
                status: 'enviado'
            });
            
            console.log(`✅ Pedido registrado na memória com ID: ${pedidoIdFinal}`);
            return { sucesso: true, pedido_id: pedidoIdFinal };
            
        } catch (error) {
            console.error(`❌ Erro ao enviar para API: ${error.message}`);
            return { sucesso: false, erro: error.message };
        }
    }
}

module.exports = ApiDatasheet;