class ExtratorFornecedor {
    constructor() {
        // Padrões para detectar CNPJ - mantidos os anteriores
        this.padroesCNPJ = [
            /CNPJ\s*[:]?\s*([\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})/i,
            /CNPJ\s*[:]?\s*([\d]{14})/i,
            /CNPJ\s*[:]?\s*([\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4})/i,
            /([\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})/,
            /([\d]{14})/,
            /([\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4})/
        ];
        
        // Padrões para detectar telefone - mantidos
        this.padroesTelefone = [
            /Telefone\s*[:]?\s*(\(?[\d]{2}\)?\s*[\d]{4,5}-?[\d]{4})/i,
            /Tel\s*[:]?\s*(\(?[\d]{2}\)?\s*[\d]{4,5}-?[\d]{4})/i,
            /(\([\d]{2}\)\s*[\d]{4,5}-[\d]{4})/,
            /(\([\d]{2}\)\s*[\d]{5}-[\d]{4})/,
            /([\d]{2}\s*[\d]{4,5}-[\d]{4})/,
            /([\d]{11})/,
            /([\d]{10})/
        ];
        
        // Padrões para detectar Inscrição Estadual - mantidos
        this.padroesIE = [
            /IE\s*[:]?\s*([\d.\-\/]+)/i,
            /Inscrição\s*Estadual\s*[:]?\s*([\d.\-\/]+)/i,
            /Insc\.?\s*Est\.?\s*[:]?\s*([\d.\-\/]+)/i,
            /([\d]{3}\.[\d]{3}\.[\d]{3}\.[\d]{3})/,
            /([\d]{12})/,
            /([\d]{9})/,
            /([\d]{14})/
        ];
        
        // Padrões para detectar email - mantidos
        this.padroesEmail = [
            /Email\s*[:]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
            /E-mail\s*[:]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
            /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
        ];
        
        // Padrões para detectar nome/razão social - mantidos
        this.padroesNome = [
            /Razão\s*Social\s*[:]?\s*(.+)/i,
            /Nome\s*[:]?\s*(.+)/i,
            /Fornecedor\s*[:]?\s*(.+)/i,
            /Empresa\s*[:]?\s*(.+)/i
        ];
    }

    analisarMensagem(texto) {
        console.log(`🏢 Analisando mensagem para fornecedor...`);
        
        const resultado = {
            cnpj: null,
            telefone: null,
            inscricaoEstadual: null,
            email: null,
            nome: null,
            completo: false
        };
        
        // Primeiro, verificar se a mensagem é apenas um CNPJ
        const textoLimpo = texto.replace(/\s/g, '').toLowerCase();
        
        // Verificar se a mensagem é basicamente apenas um CNPJ (com ou sem formatação)
        const cnpjMatch = texto.match(/([\d]{14}|[\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2}|[\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4})/);
        
        if (cnpjMatch && texto.trim().replace(/[^\d]/g, '').length <= 14) {
            // Se a mensagem parece ser principalmente um CNPJ
            const apenasNumeros = texto.replace(/[^\d]/g, '');
            if (apenasNumeros.length === 14) {
                resultado.cnpj = this.formatarCNPJ(apenasNumeros);
                console.log(`🔍 CNPJ identificado como mensagem principal: ${resultado.cnpj}`);
                resultado.completo = true;
                return resultado;
            }
        }
        
        // Extrair CNPJ
        for (const padrao of this.padroesCNPJ) {
            const match = texto.match(padrao);
            if (match) {
                resultado.cnpj = this.formatarCNPJ(match[1]);
                console.log(`🔍 CNPJ encontrado: ${resultado.cnpj}`);
                break;
            }
        }
        
        // Extrair Inscrição Estadual
        for (const padrao of this.padroesIE) {
            const match = texto.match(padrao);
            if (match) {
                resultado.inscricaoEstadual = this.formatarIE(match[1]);
                console.log(`🔍 IE encontrada: ${resultado.inscricaoEstadual}`);
                break;
            }
        }
        
        // Extrair Telefone
        for (const padrao of this.padroesTelefone) {
            const match = texto.match(padrao);
            if (match) {
                resultado.telefone = this.formatarTelefone(match[1]);
                console.log(`🔍 Telefone encontrado: ${resultado.telefone}`);
                break;
            }
        }
        
        // Extrair Email
        for (const padrao of this.padroesEmail) {
            const match = texto.match(padrao);
            if (match) {
                resultado.email = match[1].toLowerCase();
                console.log(`🔍 Email encontrado: ${resultado.email}`);
                break;
            }
        }
        
        // Extrair Nome/Razão Social
        for (const padrao of this.padroesNome) {
            const match = texto.match(padrao);
            if (match) {
                resultado.nome = this.limparTexto(match[1]);
                console.log(`🔍 Nome encontrado: ${resultado.nome.substring(0, 40)}...`);
                break;
            }
        }
        
        // Se não encontrou nome nos padrões específicos, tenta extrair do contexto
        if (!resultado.nome) {
            resultado.nome = this.extrairNomeDoContexto(texto, resultado);
        }
        
        // Verificar se tem os campos obrigatórios
        resultado.completo = resultado.cnpj;
        
        return resultado;
    }
    
    extrairNomeDoContexto(texto, dadosExtraidosc) {
        // Remover os dados já extraídos para encontrar o nome
        let textoLimpo = texto;
        
        if (dadosExtraidosc.cnpj) {
            textoLimpo = textoLimpo.replace(dadosExtraidosc.cnpj, '');
        }
        if (dadosExtraidosc.inscricaoEstadual) {
            textoLimpo = textoLimpo.replace(dadosExtraidosc.inscricaoEstadual, '');
        }
        if (dadosExtraidosc.telefone) {
            textoLimpo = textoLimpo.replace(dadosExtraidosc.telefone, '');
        }
        if (dadosExtraidosc.email) {
            textoLimpo = textoLimpo.replace(dadosExtraidosc.email, '');
        }
        
        // Remover palavras chave
        const palavrasChave = [
            'CNPJ', 'TELEFONE', 'TELEF', 'TEL', 'INSCRIÇÃO', 'INSC', 
            'ESTADUAL', 'IE', 'EMAIL', 'E-MAIL', 'CADASTRAR', 
            'FORNECEDOR', ':', '-', '/'
        ];
        
        palavrasChave.forEach(palavra => {
            textoLimpo = textoLimpo.replace(new RegExp(palavra, 'gi'), '');
        });
        
        // Limpar e pegar a primeira linha significativa
        const linhas = textoLimpo.split('\n')
            .map(l => l.trim())
            .filter(l => l && l.length > 3 && !/\d{14,}/.test(l)); // Filtra linhas com muitos números
        
        if (linhas.length > 0) {
            return this.limparTexto(linhas[0]).substring(0, 100);
        }
        
        return null;
    }
    
    formatarCNPJ(cnpj) {
        if (!cnpj) return null;
        
        // Remove tudo que não é número
        const apenasNumeros = cnpj.replace(/\D/g, '');
        
        // Verifica se tem 14 dígitos
        if (apenasNumeros.length === 14) {
            return `${apenasNumeros.substring(0, 2)}.${apenasNumeros.substring(2, 5)}.${apenasNumeros.substring(5, 8)}/${apenasNumeros.substring(8, 12)}-${apenasNumeros.substring(12, 14)}`;
        }
        
        // Se não tem 14 dígitos, retorna limpo
        return apenasNumeros;
    }
    
    formatarIE(ie) {
        if (!ie) return null;
        
        // Remove tudo que não é número
        const apenasNumeros = ie.replace(/\D/g, '');
        return apenasNumeros;
    }
    
    formatarTelefone(telefone) {
        if (!telefone) return null;
        
        // Remove tudo que não é número
        const apenasNumeros = telefone.replace(/\D/g, '');
        
        // Se tem 10 dígitos (fixo) ou 11 dígitos (celular)
        if (apenasNumeros.length === 10) {
            return `(${apenasNumeros.substring(0, 2)}) ${apenasNumeros.substring(2, 6)}-${apenasNumeros.substring(6, 10)}`;
        } else if (apenasNumeros.length === 11) {
            return `(${apenasNumeros.substring(0, 2)}) ${apenasNumeros.substring(2, 7)}-${apenasNumeros.substring(7, 11)}`;
        }
        
        // Se não tem formato conhecido, retorna limpo
        return apenasNumeros;
    }
    
    limparTexto(texto) {
        return texto
            .replace(/[^\w\sÀ-ÿ]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

class ValidadorFornecedor {
    validarFornecedor(fornecedor) {
        // CNPJ
        const cnpjValido = fornecedor.cnpj && /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(fornecedor.cnpj);
        
        const aprovado = cnpjValido;
        
        return {
            aprovado: aprovado,
            dados: fornecedor,
            motivo: aprovado ? 'Aprovado' : `Inválido: ${!cnpjValido?'CNPJ':''}`
        };
    }
}

module.exports = { ExtratorFornecedor, ValidadorFornecedor };