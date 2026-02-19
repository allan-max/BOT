const TIMEOUT_CONTEXTO = 60 * 1000;

class ContextoSilencioso {
    constructor() {
        this.produtosPendentes = [];
        this.fornecedoresPendentes = [];
        this.ultimoProdutoProcessado = null;
        this.ultimoFornecedorProcessado = null;
        this.timestampUltimaMensagem = null;
    }
    
    adicionarProdutoPendente(produto, msgId) {
        this.produtosPendentes.push({
            produto: produto,
            msgId: msgId,
            timestamp: Date.now()
        });
        
        if (this.produtosPendentes.length > 5) {
            this.produtosPendentes.shift();
        }
    }
    
    adicionarFornecedorPendente(fornecedor, msgId) {
        this.fornecedoresPendentes.push({
            fornecedor: fornecedor,
            msgId: msgId,
            timestamp: Date.now()
        });
        
        if (this.fornecedoresPendentes.length > 5) {
            this.fornecedoresPendentes.shift();
        }
    }
    
    getUltimoProdutoPendente() {
        if (this.produtosPendentes.length === 0) return null;
        return this.produtosPendentes[this.produtosPendentes.length - 1];
    }
    
    getUltimoFornecedorPendente() {
        if (this.fornecedoresPendentes.length === 0) return null;
        return this.fornecedoresPendentes[this.fornecedoresPendentes.length - 1];
    }
    
    completarUltimoProdutoPendente(ncm) {
        if (this.produtosPendentes.length === 0) return null;
        
        const ultimo = this.produtosPendentes.pop();
        ultimo.produto.ncm = ncm;
        return ultimo;
    }
    
    completarUltimoProdutoPendenteComPreco(preco) {
        if (this.produtosPendentes.length === 0) return null;
        
        const ultimo = this.produtosPendentes.pop();
        ultimo.produto.preco = preco;
        return ultimo;
    }
    
    completarUltimoFornecedorPendenteComDados(dados) {
        if (this.fornecedoresPendentes.length === 0) return null;
        
        const ultimo = this.fornecedoresPendentes.pop();
        // Atualiza os campos que foram fornecidos
        Object.keys(dados).forEach(key => {
            if (dados[key]) {
                ultimo.fornecedor[key] = dados[key];
            }
        });
        return ultimo;
    }
    
    limparExpirados() {
        const agora = Date.now();
        this.produtosPendentes = this.produtosPendentes.filter(item => 
            agora - item.timestamp < TIMEOUT_CONTEXTO
        );
        this.fornecedoresPendentes = this.fornecedoresPendentes.filter(item => 
            agora - item.timestamp < TIMEOUT_CONTEXTO
        );
    }
}

class GerenciadorContextoSilencioso {
    constructor() {
        this.contextos = new Map();
    }
    
    getContexto(chave) {
        if (!this.contextos.has(chave)) {
            this.contextos.set(chave, new ContextoSilencioso());
        }
        return this.contextos.get(chave);
    }
    
    limparContextosExpirados() {
        for (const [chave, contexto] of this.contextos.entries()) {
            contexto.limparExpirados();
            if (contexto.produtosPendentes.length === 0 && contexto.fornecedoresPendentes.length === 0) {
                this.contextos.delete(chave);
            }
        }
    }
}

module.exports = { GerenciadorContextoSilencioso, TIMEOUT_CONTEXTO };