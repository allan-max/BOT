// concerto é fodakkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
class ExtratorSimples {
    constructor() {
        // =========================================================================
        // 1. DEFINIÇÕES DE REGEX (ATUALIZADAS PARA SEU CASO) 
        // =========================================================================
       
        // Padrões de NCM - Inclui suporte a formatos com pontos variados e ESPAÇOS
        this.padroesNCM = [
            // Captura genérica após "NCM:" para tratar espaços depois (ex: NCM: 90.31. 8099)
            /NCM\s*[:]?\s*([\d\.\s]{8,15})/i,
            
            // Padrões específicos
            /(\d{4}\.\d{2}\.\d{2})/,
            /(\d{8})/,
            /(\d{3}\.\d{3}\.\d{2})/,       // Formato 852.781.00
            /(\d{2}\.\d{2}\.\d{2}\.\d{2})/,
            /\b(\d{8})\b/
        ];
        
        // Padrões de Unidades para proteger
        this.padroesUnidadeMedida = [
            /\b\d+[.,]\d+\s*(?:m|cm|mm|km|g|kg|mg|ml|l|w|kw|v|hz|°c|°f)(?:\s*[²³])?\b/gi,
            /\b\d+\s*(?!(?:NCM|CNPJ|CPF|CUSTO|R\$|PREÇO))(?:\s*(?:m|cm|mm|km|g|kg|mg|ml|l|w|kw|v|hz|°c|°f)(?:\s*[²³])?)\b/gi,
            /\b\d+[.,]?\d*\s*[xX]\s*\d+[.,]?\d*\b/gi, // Medidas tipo 10x15
            /\b\d+[.,]?\d*\s*%/g,
            /\b\d+\s*"/g // Polegadas (ex: 43")
        ];
        
        this.siglasNaoUnidades = ['NCM', 'CNPJ', 'CPF', 'CUSTO', 'R$', 'PREÇO', 'VALOR', 'NF', 'NFe'];
        
        // Padrões de Preço - 🔥 ATUALIZADO para aceitar 3 casas decimais (ex: 1156,000)
        this.padroesPreco = [
            /R\$\s*([\d.,]+)/i,
            /CUSTO:?\s*([\d.,]+)/i,
            // Aceita 1, 2 ou 3 casas decimais (ex: 1.234,567 ou 1156,000)
            /\b([\d]{1,3}(?:\.\d{3})*,\d{1,3})\b/, 
            /\b([\d]{1,3}(?:,\d{3})*\.\d{1,3})\b/,
            // Simples com vírgula (ex: 1156,000)
            /([\d]+,\d{1,3})/, 
            // Inteiros isolados (que não sejam NCMs)
            /\b(\d{3,})\b(?![.,]\d)(?!\s*(?:NCM|CNPJ|CPF))/i
        ];

        // Ignorar
        this.padroesIgnorar = [
            /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
            /CNPJ\s*[:]?\s*[\d./-]+/i
        ];
    }

    // =========================================================================
    // 2. MÉTODOS DE LIMPEZA E PROTEÇÃO
    // =========================================================================

    protegerUnidadesMedida(texto) {
        let textoProtegido = texto;
        const unidadesEncontradas = [];
        let contador = 1;
        
        for (const padrao of this.padroesUnidadeMedida) {
            const regex = new RegExp(padrao.source, padrao.flags);
            let match;
            while ((match = regex.exec(texto)) !== null) {
                const unidade = match[0];
                if (this.siglasNaoUnidades.some(s => unidade.toUpperCase().includes(s))) continue;
                
                if (!unidadesEncontradas.includes(unidade)) {
                    unidadesEncontradas.push(unidade);
                    // Usa replace global com escape
                    textoProtegido = textoProtegido.split(unidade).join(`[UNIDADE_${contador}]`);
                    contador++;
                }
            }
        }
        
        return {
            textoProtegido,
            restaurar: (txt) => {
                let res = txt;
                unidadesEncontradas.forEach((u, i) => res = res.split(`[UNIDADE_${i+1}]`).join(u));
                return res;
            }
        };
    }

    limparTexto(texto) {
        // Preserva hífens, colchetes e barras
        return texto.replace(/[^\w\sÀ-ÿ/\-–\[\].,]/gi, ' ').replace(/\s+/g, ' ').trim();
    }

    limparDescricao(texto) {
        if (!texto) return '';
        
        let limpo = texto;

        limpo = limpo.replace(/^\s*[-–]\s*|\s*[-–]\s*$/g, '');
        limpo = limpo.replace(/\s*[-–]?\s*NCM\s*[:.]?\s*$/i, '');
        
        // 🔥 CORREÇÃO 1: Adicionado \bR\b. Isso garante que ele só apague o "R" se for uma palavra isolada,
        // protegendo palavras que terminam com R (como HOSPITALAR, PAR, etc).
        limpo = limpo.replace(/\s*[-–]?\s*(?:R\$|\bR\b|PRE[ÇC]O|CUSTO|VALOR)\s*[:.]?\s*$/i, '');
        
        limpo = limpo.replace(/\s*[-–]\s*0+(?:[.,]0+)?\s*$/g, '');
        
        // 🔥 CORREÇÃO 2: Mesma proteção de \bR\b aqui para não engolir o "R 40"
        limpo = limpo.replace(/\s*[-–]?\s*(?:R\$|\bR\b)\s*[\d.,]+\s*$/i, '');
        
        limpo = limpo.replace(/\s*[-–]?\s*[,.]\d{2}\s*$/i, '');
        limpo = limpo.replace(/[^\w\sÀ-ÿ/\-–\[\].,()+&]/gi, ' ').replace(/\s+/g, ' ').trim();
        limpo = limpo.replace(/\s*[-–]\s*$/g, '');

        return limpo;
    }
    // =========================================================================
    // 3. CONVERSORES E EXTRATORES BÁSICOS
    // =========================================================================

    converterParaNumero(texto) {
        if (!texto) return 0;
        let valor = texto.toString().replace(/R\$/gi, '').replace(/CUSTO:?/gi, '').trim();
        
        // Remove espaços internos
        valor = valor.replace(/\s+/g, '');
        
        // Lógica para detectar separador decimal
        if (valor.includes(',') && !valor.includes('.')) {
            // 1156,000 -> 1156.000
            valor = valor.replace(/\./g, '').replace(',', '.');
        } else if (valor.includes('.') && !valor.includes(',')) {
            valor = valor.replace(/,/g, '');
        } else if (valor.includes('.') && valor.includes(',')) {
            const ultimoPonto = valor.lastIndexOf('.');
            const ultimaVirgula = valor.lastIndexOf(',');
            if (ultimaVirgula > ultimoPonto) { // Brasil: 1.000,00
                valor = valor.replace(/\./g, '').replace(',', '.');
            } else { // EUA: 1,000.00
                valor = valor.replace(/,/g, '');
            }
        }
        
        return parseFloat(valor.replace(/[^\d.-]/g, '')) || 0;
    }

    extrairPreco(texto) {
        const protecao = this.protegerUnidadesMedida(texto);
        const txt = protecao.textoProtegido;
        
        for (const padrao of this.padroesPreco) {
            const match = txt.match(padrao);
            if (match) {
                const valorMatch = match[1] || match[0];
                if (/^\d{8}$/.test(valorMatch.replace(/[.,]/g,''))) continue; // Evita NCM
                return this.converterParaNumero(valorMatch);
            }
        }
        return 0;
    }

    extrairNCM(texto) {
        for (const padrao of this.padroesNCM) {
            const match = texto.match(padrao);
            if (match) {
                // Captura o valor bruto
                const bruto = match[1];
                
                // Remove espaços e pontos para validar se é apenas números
                const apenasNumeros = bruto.replace(/[^\d]/g, '');
                
                // Se for válido (8 dígitos), retorna o valor limpo ou formatado
                if (apenasNumeros.length === 8) {
                    return apenasNumeros; // Retorna 8 dígitos limpos (ex: 90318099)
                }
                
                // Se tiver pontuação correta (ex: 9031.80.99) mas 8 digitos no total
                if (apenasNumeros.length >= 4 && apenasNumeros.length <= 10) {
                     return apenasNumeros;
                }
            }
        }
        return null;
    }

    extrairProdutoDe3Linhas(linhas) {
        // Tenta todas as combinações de ordem (Desc, Preço, NCM)
        const combinacoes = [
            [0, 1, 2], [0, 2, 1], // Desc na linha 1
            [1, 0, 2], [1, 2, 0], // Desc na linha 2
            [2, 0, 1], [2, 1, 0]  // Desc na linha 3
        ];
        
        for (const [iDesc, iPreco, iNcm] of combinacoes) {
            const desc = this.limparDescricao(linhas[iDesc]);
            const preco = this.extrairPreco(linhas[iPreco]);
            const ncm = this.extrairNCM(linhas[iNcm]);
            
            // Aceita se tem descrição, NCM e preço > 0
            if (desc.length > 2 && ncm && preco > 0) {
                return {
                    descricao: desc,
                    ncm: ncm,
                    preco: preco,
                    origem: '3_linhas_combinacao'
                };
            }
        }
        return null;
    }

    // =========================================================================
    // 🔥 CORREÇÃO: ADICIONADO O MÉTODO QUE ESTAVA FALTANDO
    // =========================================================================
    processarFormatoDescNcmPrecoSemTracos(texto) {
        console.log(`🔍 Processando formato DESC NCM PREÇO (sem traços)...`);
        
        // Tenta encontrar um NCM de 8 dígitos ou formatado
        const ncm = this.extrairNCM(texto);
        // Tenta encontrar um preço
        const preco = this.extrairPreco(texto);
        
        if (ncm && preco > 0) {
            // Remove o NCM e o preço do texto para sobrar a descrição
            let descricao = texto;
            
            // Remove NCM (tentativa frouxa para pegar formatações variadas)
            descricao = descricao.replace(ncm, ''); 
            // Remove label NCM
            descricao = descricao.replace(/NCM\s*[:]?\s*[\d.\s]+/gi, ''); 
            
            // Remove Preço
            const matchPreco = texto.match(/R\$\s*[\d.,]+/i) || texto.match(/[\d.,]{3,}/);
            if(matchPreco) {
                descricao = descricao.replace(matchPreco[0], '');
            }
            descricao = descricao.replace(/CUSTO\s*[:]?\s*[\d.,]+/gi, '');
            
            // Limpa o que sobrou
            descricao = this.limparDescricao(descricao);
            
            if (descricao && descricao.length >= 3) {
                console.log(`✅ Formato Sem Traços Encontrado: ${descricao.substring(0,30)}... | NCM: ${ncm} | R$ ${preco}`);
                return [{
                    descricao: descricao,
                    ncm: ncm,
                    preco: preco,
                    origem: 'desc_ncm_preco_sem_tracos'
                }];
            }
        }
        
        return [];
    }
    // =========================================================================
    // 🔥 VERSÃO FINAL BLINDADA: Limpeza de Preço PT-BR e Traços
    // =========================================================================
    processarListaMistaPorLinha(texto) {
        console.log(`🔍 Processando Lista Mista (Linha a Linha Independente)...`);
        
        const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        const produtos = [];
        const todosPrecosEncontrados = [];

        // -----------------------------------------------------------
        // PASSO 1: Extração inicial
        // -----------------------------------------------------------
        for (const linha of linhas) {
            const ncm = this.extrairNCM(linha);
            const preco = this.extrairPreco(linha);

            if (ncm) {
                if (preco > 0) todosPrecosEncontrados.push(preco);

                let descricao = linha;

                // 1. Remove NCM
                if (ncm) descricao = descricao.replace(ncm, '');
                descricao = descricao.replace(/\b\d{4}\.\d{2}\.\d{2}\b/g, ''); // Remove 0000.00.00
                descricao = descricao.replace(/NCM\s*[:.]?\s*/gi, '');

                // 2. Remove Preço (AGORA MAIS FORTE)
                if (preco > 0) {
                    // Remove o "R$" primeiro para não atrapalhar
                    descricao = descricao.replace(/R\$\s*/gi, '');
                    descricao = descricao.replace(/CUSTO\s*[:.]?\s*/gi, '');

                    // Gera os formatos possíveis do número
                    const formatoBR = preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); // "1.388,89"
                    const formatoSimples = preco.toFixed(2).replace('.', ','); // "1388,89"
                    const formatoPonto = preco.toFixed(2); // "1388.89"

                    // Tenta remover a versão mais complexa (com pontos) primeiro
                    if (descricao.includes(formatoBR)) {
                        descricao = descricao.replace(formatoBR, '');
                    } else if (descricao.includes(formatoSimples)) {
                        descricao = descricao.replace(formatoSimples, '');
                    } else if (descricao.includes(formatoPonto)) {
                        descricao = descricao.replace(formatoPonto, '');
                    }

                    // 🔥 SEGURANÇA EXTRA: Remove "sobras" numéricas no final da linha
                    // Ex: se sobrou " - 1.388" porque cortou os centavos
                    descricao = descricao.replace(/\s+[\d]{1,3}(?:\.\d{3})*(?:,\d{0,2})?\s*$/, '');
                }

                // 3. Limpeza de Traços (REFORÇADA)
                // Remove sequências de traços (ex: "- -")
                descricao = descricao.replace(/[-–\s]+$/g, ''); // Remove tudo que é traço ou espaço do final
                descricao = descricao.replace(/^[-–\s]+/g, ''); // Remove do início
                descricao = descricao.replace(/\s*[-–]\s*[-–]\s*/g, ' - '); // Transforma "- -" no meio em um só "-"

                descricao = this.limparDescricao(descricao);

                if (descricao && descricao.length >= 3) {
                    produtos.push({
                        descricao: descricao,
                        ncm: ncm,
                        preco: preco,
                        origem: 'lista_mista_inicial'
                    });
                }
            }
        }

        // -----------------------------------------------------------
        // PASSO 2: Inferência de Preço
        // -----------------------------------------------------------
        let precoSugerido = 0;
        if (todosPrecosEncontrados.length > 0) {
            const contagem = {};
            let maxRepeticoes = 0;
            let valorMaisComum = 0;

            for (const p of todosPrecosEncontrados) {
                const chave = p.toFixed(2);
                contagem[chave] = (contagem[chave] || 0) + 1;
                if (contagem[chave] > maxRepeticoes) {
                    maxRepeticoes = contagem[chave];
                    valorMaisComum = p;
                }
            }
            precoSugerido = valorMaisComum;
        }

        // -----------------------------------------------------------
        // PASSO 3: Preencher buracos
        // -----------------------------------------------------------
        if (produtos.length > 0) {
            if (precoSugerido > 0) {
                produtos.forEach(p => {
                    if (p.preco === 0) {
                        p.preco = precoSugerido;
                        p.origem = 'lista_mista_preco_inferido';
                    }
                });
            }
            console.log(`✅ ${produtos.length} produtos identificados na lista mista.`);
            return produtos;
        }
        
        return [];
    }
    // =========================================================================
    // 🔥 NOVO: Processar Bloco com NCM Único (Compartilhado no Topo ou Fim)
    // =========================================================================
    processarBlocoComNCMUnico(texto) {
        console.log("🔍 Tentando Bloco com NCM Único/Compartilhado...");
        const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        
        if (linhas.length < 2) return [];

        // 1. Procura o NCM isolado (pode estar na primeira ou na última linha)
        let ncmCompartilhado = null;
        let indexNcm = -1;
        
        // Verifica primeira linha
        const ncmInicio = this.extrairNCM(linhas[0]);
        if (ncmInicio && linhas[0].replace(/[^\d]/g, '').length <= 14) { // Linha curta, quase só números
            ncmCompartilhado = ncmInicio;
            indexNcm = 0;
        }
        
        // Verifica última linha (se não achou no início)
        if (!ncmCompartilhado) {
            const ultimoIndex = linhas.length - 1;
            const ncmFim = this.extrairNCM(linhas[ultimoIndex]);
            if (ncmFim && linhas[ultimoIndex].replace(/[^\d]/g, '').length <= 14) {
                ncmCompartilhado = ncmFim;
                indexNcm = ultimoIndex;
            }
        }

        if (!ncmCompartilhado) return []; // Se não achou NCM isolado, sai.

        console.log(`📌 NCM Compartilhado detectado: ${ncmCompartilhado}`);
        const produtos = [];

        // 2. Processa as outras linhas usando esse NCM
        for (let i = 0; i < linhas.length; i++) {
            if (i === indexNcm) continue; // Pula a linha do NCM

            const linha = linhas[i];
            const preco = this.extrairPreco(linha);
            
            // Aceita se tiver preço (descrição + preço)
            if (preco > 0) {
                let descricao = linha;
                
                // Remove o preço da descrição para limpar
                // Tenta remover valor exato ou genérico
                const precoFormatado = preco.toFixed(2).replace('.', ',');
                const regexPreco = new RegExp(`R\\$?\\s*${precoFormatado.replace('.', '\\.')}|${precoFormatado.replace('.', '\\.')}`, 'i');
                const matchP = linha.match(regexPreco) || linha.match(/[\d]{1,3}(?:[.,]\d{3})*[.,]\d{2}/);
                
                if (matchP) descricao = descricao.replace(matchP[0], '');
                
                // Limpezas finais
                descricao = descricao.replace(/\s*[-–]\s*$/g, '');
                descricao = this.limparDescricao(descricao);

                if (descricao.length >= 3) {
                    produtos.push({
                        descricao: descricao,
                        ncm: ncmCompartilhado, // Usa o NCM encontrado lá no fim/início
                        preco: preco,
                        origem: 'ncm_compartilhado_bloco'
                    });
                }
            }
        }

        return produtos;
    }

    // 🔥 NOVO MÉTODO: Processar formato com "CUSTO" e "NCM" separados
    processarFormatoCustoNcm(texto) {
        console.log(`🔍 Processando formato CUSTO NCM...`);
        
        // Padrão Genérico: Procura "CUSTO" valor ... "NCM" valor (ou vice versa)
        const preco = this.extrairPreco(texto);
        const ncm = this.extrairNCM(texto);
        
        if (preco > 0 && ncm) {
            // Se encontrou ambos, vamos tentar isolar a descrição
            let descricao = texto;
            
            // Remove as partes numéricas encontradas
            const regexNcmLimpeza = new RegExp(`NCM\\s*[:]?\\s*[\\d.\\s]+`, 'yi'); // Remove label NCM e números
            
            // Estratégia de limpeza agressiva para sobrar a descrição
            descricao = descricao.replace(/NCM\s*[:]?\s*[\d.\s-]+/gi, ' '); // Remove NCM label e números
            descricao = descricao.replace(/CUSTO\s*[:]?\s*R?\$?\s*[\d.,]+/gi, ' '); // Remove CUSTO label e números
            descricao = descricao.replace(ncm, ''); // Remove o número do NCM se sobrou
            
            // Remove o valor do preço se sobrou isolado
            const valorPrecoFormatado = preco.toString().replace('.', ',');
            if(descricao.includes(valorPrecoFormatado)) {
                 descricao = descricao.replace(valorPrecoFormatado, '');
            }

            descricao = this.limparDescricao(descricao);
            
            if (descricao && descricao.length >= 3) {
                 console.log(`✅ Formato CUSTO/NCM flexível encontrado: ${descricao.substring(0, 40)}... | NCM: ${ncm} | R$ ${preco}`);
                return [{
                    descricao: descricao,
                    ncm: ncm,
                    preco: preco,
                    origem: 'formato_custo_ncm_flexivel'
                }];
            }
        }
        
        return [];
    }

    deveIgnorar(texto) {
        for (const padrao of this.padroesIgnorar) {
            if (padrao.test(texto)) {
                console.log(`🚫 Ignorando texto com CPF/CNPJ: ${texto.substring(0, 50)}...`);
                return true;
            }
        }
        return false;
    }
    extrairApenasNCM(texto) {
        // Procura por 8 dígitos (ex: 1234.56.78 ou 12345678)
        const match = texto.match(/\b\d{4}\.?\d{2}\.?\d{2}\b/);
        if (match) {
            return match[0].replace(/\./g, '');
        }
        return null;
    }
    extrairApenasPreco(texto) {
        const preco = this.extrairPreco(texto);
        return preco > 0 ? preco : null;
    }

analisarMensagem(texto, contextoAnterior = null) {
        console.log(`🧠 ANÁLISE INICIADA`);
        
        // 1. Limpeza e Proteção Inicial
        const protecao = this.protegerUnidadesMedida(texto);
        const textoProcessavel = protecao.textoProtegido;
        // Filtra linhas vazias
        const linhasProcessadas = textoProcessavel.split(/\r?\n/).map(l => l.trim()).filter(l => l);

        if (this.deveIgnorar(texto)) return [];

        const finalizar = (lista) => lista.map(p => {
            if (p.descricao) p.descricao = protecao.restaurar(p.descricao);
            return p;
        });

        // =================================================================================
        // 🏆 PRIORIDADE 1: LISTAS MISTAS CLARAS (Muitas linhas)
        // =================================================================================
        // Se for o caso das Camisas/Calças (várias linhas, cada uma com seu dado)
        const produtosListaMista = this.processarListaMistaPorLinha(textoProcessavel);
        if (produtosListaMista.length > 0) {
             const proporcao = produtosListaMista.length / linhasProcessadas.length;
             // Só assume que é lista mista se tiver mais de 1 item OU se for muito consistente
             if (produtosListaMista.length > 1 || proporcao >= 0.5) {
                console.log(`🎯 Lista Mista detectada (Prioridade Alta): ${produtosListaMista.length} itens`);
                return finalizar(produtosListaMista);
             }
        }

       // =================================================================================
        // 🏆 PRIORIDADE 2: BLOCOS DE 3 LINHAS (ÚNICO OU MÚLTIPLOS)
        // =================================================================================
        // Se a mensagem tiver 3 ou mais linhas, tentamos varrer de 3 em 3
        if (linhasProcessadas.length >= 3) {
            console.log(`🔍 Tentando encaixar blocos de 3 linhas...`);
            const produtos3Linhas = [];
            let i = 0;
            
            while (i <= linhasProcessadas.length - 3) {
                // Pega um pedaço de 3 linhas
                const chunk = linhasProcessadas.slice(i, i + 3);
                const produto = this.extrairProdutoDe3Linhas(chunk);
                
                if (produto) {
                    // Encaixou perfeitamente! Guarda o produto e pula 3 linhas pra frente
                    produtos3Linhas.push(produto);
                    i += 3; 
                } else {
                    // Não encaixou, avança só 1 linha pra tentar a próxima combinação (ignora "ruídos" no texto)
                    i++; 
                }
            }
            
            // Se achou produtos e eles formam a maior parte da mensagem (para evitar falsos positivos)
            if (produtos3Linhas.length > 0 && (produtos3Linhas.length * 3) >= (linhasProcessadas.length * 0.5)) {
                console.log(`✅ Sucesso na extração de ${produtos3Linhas.length} produtos formatados em 3 linhas!`);
                return finalizar(produtos3Linhas);
            }
        }

        // =================================================================================
        // 🏆 PRIORIDADE 3: LISTAS COM NCM COMPARTILHADO (O CASO DOS BRINQUEDOS)
        // =================================================================================
        // Só tenta isso agora se não for o caso de 3 linhas acima
        const produtosNCMUnico = this.processarBlocoComNCMUnico(textoProcessavel);
        if (produtosNCMUnico.length > 0) {
            // Aceita se encontrou itens na maioria das linhas
            if (produtosNCMUnico.length >= (linhasProcessadas.length - 1) * 0.4) {
                console.log(`✅ Bloco NCM Único: ${produtosNCMUnico.length} itens`);
                return finalizar(produtosNCMUnico);
            }
        }

        // =================================================================================
        // 🏆 PRIORIDADE 4: TENTATIVAS DE LINHA ÚNICA OU BLOCO "CUSTO NCM"
        // =================================================================================
        
        const linhas = textoProcessavel.split(/\r?\n/);

        // Caso Linha Única
        if (linhas.length === 1) {
            const produtosPadraoDescNcmPreco = this.processarPadraoDescNcmPreco(textoProcessavel);
            if (produtosPadraoDescNcmPreco.length > 0) {
                return finalizar(produtosPadraoDescNcmPreco);
            }
        }

        // Caso Custo NCM (Geral)
        const produtosCustoNcm = this.processarFormatoCustoNcm(textoProcessavel);
        if (produtosCustoNcm.length > 0) {
            if (linhasProcessadas.length <= 2) {
                return finalizar(produtosCustoNcm);
            }
        }

        // Caso Sem Traços
        const produtosSemTracos = this.processarFormatoDescNcmPrecoSemTracos(textoProcessavel);
        if (produtosSemTracos.length > 0) {
            return finalizar(produtosSemTracos);
        }

        // =================================================================================
        // FALLBACKS (Contexto, apenas preço, apenas NCM...)
        // =================================================================================
        
        if (contextoAnterior && contextoAnterior.produtosPendentes.length > 0) {
            const completados = this.tentarCompletarMultiplosComContexto(textoProcessavel, contextoAnterior);
            if (completados && completados.length > 0) return finalizar(completados);
            
            const completado = this.tentarCompletarComContexto(textoProcessavel, contextoAnterior);
            if (completado) return finalizar([completado]);
        }
        
        const apenasNCM = this.extrairApenasNCM(textoProcessavel);
        if (apenasNCM) return [{ apenasNCM: apenasNCM }];
        
        const apenasPreco = this.extrairApenasPreco(textoProcessavel);
        if (apenasPreco) return [{ apenasPreco: apenasPreco }];

        // Última tentativa: Descrição + Preço (sem NCM)
        const descricao = this.extrairDescricao(textoProcessavel);
        const preco = this.extrairPreco(textoProcessavel);
        
        if (descricao && preco > 0) {
            return finalizar([{
                descricao: descricao,
                preco: preco,
                ncm: null,
                origem: 'sem_ncm'
            }]);
        }
        
        console.log("❌ Nada identificado.");
        return [];
    }
    
    // 🔥 MÉTODO: Extrair todos os preços com posições
    extrairTodosPrecos(texto) {
        const precos = [];
        // 🔥 ATUALIZADO: Aceita 1-2 dígitos após vírgula
        const regexPreco = /([\d]{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2})/g;
        let match;
        
        while ((match = regexPreco.exec(texto)) !== null) {
            precos.push({
                preco: match[0],
                posicao: match.index,
                comprimento: match[0].length
            });
        }
        
        return precos;
    }

    // 🔥 MÉTODO: Extrair todos os NCMs com posições
    extrairTodosNCMs(texto) {
        const ncmList = [];
        
        // Padrões para NCM (8 dígitos, 4.2.2, etc.)
        const padroes = [
            { regex: /\b(\d{8})\b/g, tipo: '8digitos' },
            { regex: /\b(\d{4}\.\d{2}\.\d{2})\b/g, tipo: '4.2.2' },
            { regex: /\b(\d{2}\.\d{2}\.\d{2}\.\d{2})\b/g, tipo: '2.2.2.2' }
        ];
        
        for (const padrao of padroes) {
            let match;
            while ((match = padrao.regex.exec(texto)) !== null) {
                // Evitar capturar números que são parte de descrições (ex: 19 PCS)
                const contextoAntes = texto.substring(Math.max(0, match.index - 10), match.index);
                const contextoDepois = texto.substring(match.index + match[0].length, Math.min(texto.length, match.index + match[0].length + 10));
                
                // Se o contexto contém palavras, provavelmente é um NCM, não parte de uma descrição
                const temPalavrasAntes = /[a-zA-ZÀ-ÿ]/.test(contextoAntes);
                const temPalavrasDepois = /[a-zA-ZÀ-ÿ]/.test(contextoDepois);
                
                if (temPalavrasAntes || temPalavrasDepois || padrao.tipo !== '8digitos') {
                    ncmList.push({
                        ncm: match[1],
                        posicao: match.index,
                        comprimento: match[0].length,
                        tipo: padrao.tipo
                    });
                }
            }
        }
        
        // Ordenar por posição no texto
        ncmList.sort((a, b) => a.posicao - b.posicao);
        
        return ncmList;
    }

    // 🔥 NOVO MÉTODO: Processar padrão de linha única "DESC - NCM - PREÇO"
    processarPadraoDescNcmPreco(texto) {
        console.log(`🔍 Processando padrão DESC - NCM - PREÇO...`);
        
        // 🔥 NOVO PADRÃO: Para capturar "DESC - ncm NCM - ncm PREÇO" (erro de digitação)
        const padraoErroNcmDuplo = /(.+?)\s*[-–]\s*ncm\s*[:]?\s*(\d{8}|\d{4}\.\d{2}\.\d{2})\s*[-–]\s*ncm\s*[:]?\s*([\d.,]+)/i;
        const matchErroNcmDuplo = texto.match(padraoErroNcmDuplo);
        if (matchErroNcmDuplo) {
            let descricao = matchErroNcmDuplo[1].trim();
            const ncm = matchErroNcmDuplo[2];
            const preco = this.converterParaNumero(matchErroNcmDuplo[3]);
            
            descricao = descricao.replace(/\s*[-–]\s*$/, '');
            descricao = this.limparDescricao(descricao);
            
            if (descricao && descricao.length >= 3 && ncm && preco > 0) {
                console.log(`✅ Padrão NCM duplicado (erro) corrigido: ${descricao.substring(0, 40)}... | NCM: ${ncm} | R$ ${preco}`);
                return [{
                    descricao: descricao,
                    ncm: ncm,
                    preco: preco,
                    origem: 'erro_ncm_duplo_corrigido'
                }];
            }
        }
        
        // Padrão MELHORADO: "DESCRIÇÃO - NCM 85176294 - R$ 130,00" ou "DESCRIÇÃO - NCM 85176294 - preço 130,00"
        const padrao1 = /(.+?)\s*[-–]\s*(?:NCM\s*[:]?\s*)?(\d{8}|\d{4}\.\d{2}\.\d{2})\s*[-–]\s*(?:R\$\s*|pre[çc]o\s*[:]?\s*)?([\d.,]+)/i;
        
        // Padrão MELHORADO: "DESCRIÇÃO NCM 85176294 - R$ 130,00" ou "DESCRIÇÃO NCM 85176294 - preço 130,00"
        const padrao2 = /(.+?)\s+(?:NCM\s*[:]?\s*)?(\d{8}|\d{4}\.\d{2}\.\d{2})\s*[-–]\s*(?:R\$\s*|pre[çc]o\s*[:]?\s*)?([\d.,]+)/i;
        
        // 🔥 PADRÃO CORRIGIDO: "DESC PREÇO NCM" (sem traços, formato do microondas)
        // Exemplo: "MICROONDAS LG 30L MS3033DSA 110V 614,00 8516.50.00"
        const padrao3 = /(.+?)\s+([\d.,]+)\s+(\d{4}\.\d{2}\.\d{2}|\d{8})\b/m;
        
        console.log(`🔍 Tentando padrão 3 (formato microondas) com texto: "${texto}"`);
        
        const match1 = texto.match(padrao1);
        const match2 = texto.match(padrao2);
        const match3 = texto.match(padrao3);
        
        console.log(`📊 Resultados - Padrão1: ${match1 ? 'Sim' : 'Não'}, Padrão2: ${match2 ? 'Sim' : 'Não'}, Padrão3: ${match3 ? 'Sim' : 'Não'}`);
        
        // 🔥 PRIORIZAR O PADRÃO 3 (formato microondas) se ele for encontrado
        if (match3) {
            console.log(`✅ Padrão 3 detectado!`);
            console.log(`📊 Grupos: [1]="${match3[1]}", [2]="${match3[2]}", [3]="${match3[3]}"`);
            
            let descricao = match3[1].trim();
            const precoStr = match3[2];
            const ncm = match3[3];
            
            // Converter preço para número
            const preco = this.converterParaNumero(precoStr);
            
            // Limpar a descrição
            descricao = this.limparDescricao(descricao);
            
            if (descricao && descricao.length >= 3 && ncm && preco > 0) {
                console.log(`✅ Formato microondas correto: ${descricao.substring(0, 40)}... | NCM: ${ncm} | R$ ${preco}`);
                return [{
                    descricao: descricao,
                    ncm: ncm,
                    preco: preco,
                    origem: 'formato_microondas'
                }];
            }
        }
        
        // Se não encontrou no padrão 3, tentar os outros padrões
        const match = match1 || match2;
        
        if (match) {
            let descricao = match[1].trim();
            const ncm = match[2];
            const preco = this.converterParaNumero(match[3]);
            
            // Limpar a descrição - remover qualquer "NCM" que possa ter sobrado
            descricao = descricao.replace(/\s*NCM\s*[:]?\s*/gi, '');
            descricao = descricao.replace(/\s*[-–]\s*$/, '');
            descricao = this.limparDescricao(descricao);
            
            if (descricao && descricao.length >= 3 && ncm && preco > 0) {
                console.log(`✅ Padrão DESC-NCM-PREÇO encontrado: ${descricao.substring(0, 40)}... | NCM: ${ncm} | R$ ${preco}`);
                return [{
                    descricao: descricao,
                    ncm: ncm,
                    preco: preco,
                    origem: 'desc_ncm_preco_especifico'
                }];
            }
        }
        
        return [];
    }

    // 🔥 MÉTODO MELHORADO: Processar múltiplos produtos com NCM compartilhado (geral)
    processarMultiplosComNCMCompartilhado(texto) {
        console.log(`🔍 Processando múltiplos produtos com NCM compartilhado...`);
        
        // Verificar se o texto tem características de múltiplos produtos
        // (múltiplos preços, comprimento considerável)
        const precos = this.extrairTodosPrecos(texto);
        if (precos.length < 2) {
            console.log(`❌ Poucos preços (${precos.length}) para múltiplos produtos`);
            return [];
        }
        
        console.log(`📊 Encontrados ${precos.length} preços no texto`);
        
        // Encontrar todos os NCMs no texto
        const todosNCMs = this.extrairTodosNCMs(texto);
        console.log(`📊 Encontrados ${todosNCMs.length} NCM(s) no texto`);
        
        // Se não encontrou NCM, não pode processar
        if (todosNCMs.length === 0) {
            console.log(`❌ Nenhum NCM encontrado para compartilhar`);
            return [];
        }
        
        // Decidir qual NCM usar:
        // 1. Se há apenas um NCM, usar ele para todos
        // 2. Se há múltiplos NCMs, usar o último (geralmente é o que aparece no final para todos)
        const ncmParaCompartilhar = todosNCMs[todosNCMs.length - 1].ncm;
        console.log(`📌 NCM para compartilhar com todos: ${ncmParaCompartilhar}`);
        
        // Verificar se o NCM está no final do texto (padrão comum)
        const ultimoNCM = todosNCMs[todosNCMs.length - 1];
        const posicaoFinal = texto.length;
        const estaNoFinal = (ultimoNCM.posicao + ultimoNCM.ncm.length) > (posicaoFinal * 0.8); // Últimos 20% do texto
        
        if (!estaNoFinal && todosNCMs.length === 1) {
            console.log(`⚠️  NCM não está no final do texto, pode não ser compartilhado`);
        }
        
        // Agora extrair produtos do texto
        const produtos = [];
        
        // Dividir o texto em partes usando os preços como marcadores
        let posicaoAnterior = 0;
        
        for (let i = 0; i < precos.length; i++) {
            const precoInfo = precos[i];
            const precoValor = this.converterParaNumero(precoInfo.preco);
            
            // Texto entre a posição anterior e este preço é a descrição
            let textoDescricao = texto.substring(posicaoAnterior, precoInfo.posicao).trim();
            
            // Limpar a descrição - remover traços finais e espaços extras
            let descricao = textoDescricao.replace(/\s*[-–]\s*$/g, '');
            descricao = descricao.replace(/^\s*[-–]\s*/g, '');
            descricao = this.limparDescricao(descricao);
            
            // Verificar se a descrição não é vazia, não é um número (NCM) e tem tamanho mínimo
            if (descricao && descricao.length >= 3 && precoValor > 0) {
                // Verificar se não é um número de NCM disfarçado
                const pareceNCM = /^\d{4,8}$/.test(descricao) || /^\d{2}\.\d{2}\.\d{2}\.\d{2}$/.test(descricao);
                
                if (!pareceNCM) {
                    // Verificar se esta descrição já foi vista (evitar duplicatas)
                    const descricaoCurta = descricao.substring(0, 50);
                    const jaExiste = produtos.some(p => p.descricao.startsWith(descricaoCurta));
                    
                    if (!jaExiste) {
                        produtos.push({
                            descricao: descricao,
                            ncm: ncmParaCompartilhar, // Usar o NCM compartilhado para TODOS
                            preco: precoValor,
                            origem: 'ncm_compartilhado_todos'
                        });
                        console.log(`✅ Produto ${i+1}: ${descricao.substring(0, 40)}... | R$ ${precoValor} | NCM: ${ncmParaCompartilhar}`);
                    }
                }
            }
            
            // Atualizar posição anterior para depois deste preço
            posicaoAnterior = precoInfo.posicao + precoInfo.preco.length;
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Processar múltiplas linhas com NCM compartilhado
    processarMultiplasLinhasComNCMCompartilhado(texto) {
        console.log(`🔍 Processando múltiplas linhas com NCM compartilhado...`);
        
        const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        
        if (linhas.length < 2) return [];
        
        const produtos = [];
        let ultimoNCM = null;
        
        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i];
            
            // Tentar extrair NCM desta linha
            const ncmDaLinha = this.extrairNCM(linha);
            
            // Se encontrou NCM nesta linha, atualiza o último NCM
            if (ncmDaLinha) {
                ultimoNCM = ncmDaLinha;
                console.log(`📌 NCM encontrado na linha ${i+1}: ${ncmDaLinha}`);
            }
            
            // Extrair produto da linha
            const produto = this.extrairProdutoDeLinha(linha, ultimoNCM);
            
            if (produto) {
                // Se o produto não tem NCM mas temos um último NCM, usa ele
                if (!produto.ncm && ultimoNCM) {
                    produto.ncm = ultimoNCM;
                    produto.origem = 'ncm_compartilhado_multi_linhas';
                }
                
                produtos.push(produto);
                console.log(`✅ Linha ${i+1}: ${produto.descricao.substring(0, 30)}... | NCM: ${produto.ncm || 'Nenhum'}`);
            }
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Processar formato com NCM compartilhado
    processarFormatoNCMCompartilhado(texto) {
        console.log(`🔍 Processando formato com NCM compartilhado...`);
        
        // 🔥 NOVO: Se o texto tem apenas um produto no padrão "DESC - NCM - PREÇO", não processar aqui
        // (deixe o método específico lidar com isso)
        const linhas = texto.split(/\r?\n/);
        if (linhas.length === 1) {
            const padraoSimples = /(.+?)\s*[-–]\s*(?:NCM\s*[:]?\s*)?\d{4,8}(?:\.\d{1,4}){0,2}\s*[-–]\s*(?:R\$\s*)?[\d.,]+/i;
            if (padraoSimples.test(texto)) {
                console.log(`⚠️  Padrão simples detectado, pulando processamento compartilhado`);
                return [];
            }
        }
        
        // Formato: "DESC1 - NCM - PRECO1 DESC2 - PRECO2" (primeiro tem NCM, segundo não tem)
        // Ou: "DESC1 - NCM - PRECO1 DESC2 - NCM - PRECO2" (ambos têm NCM)
        
        // Primeiro, vamos encontrar todos os NCMs no texto
        const todosNCMs = [];
        let matchNCM;
        const regexNCM = /\b(\d{8})\b/g;
        
        while ((matchNCM = regexNCM.exec(texto)) !== null) {
            todosNCMs.push({
                ncm: matchNCM[1],
                posicao: matchNCM.index
            });
        }
        
        console.log(`📊 NCMs encontrados: ${todosNCMs.length}`);
        
        // Se não há NCMs, não há compartilhamento
        if (todosNCMs.length === 0) return [];
        
        // Vamos dividir o texto em segmentos usando os NCMs como marcadores
        const produtos = [];
        let ultimaPosicao = 0;
        let ultimoNCM = null;
        
        for (let i = 0; i < todosNCMs.length; i++) {
            const ncmAtual = todosNCMs[i];
            
            // Texto entre a última posição e este NCM
            const segmento = texto.substring(ultimaPosicao, ncmAtual.posicao).trim();
            
            // Extrair preços deste segmento
            const precosSegmento = [];
            let matchPreco;
            const regexPreco = /([\d]{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2})/g;
            
            while ((matchPreco = regexPreco.exec(segmento)) !== null) {
                precosSegmento.push({
                    preco: matchPreco[0],
                    posicao: matchPreco.index
                });
            }
            
            console.log(`🔍 Segmento ${i}: "${segmento.substring(0, 50)}..." | ${precosSegmento.length} preços`);
            
            // Se há preços no segmento, tentar extrair produtos
            if (precosSegmento.length > 0) {
                // Para cada preço, tentar extrair a descrição correspondente
                for (let j = 0; j < precosSegmento.length; j++) {
                    const precoAtual = precosSegmento[j];
                    const precoStr = precoAtual.preco;
                    const precoValor = this.converterParaNumero(precoStr);
                    
                    // Encontrar o início da descrição (desde o início do segmento ou após o último preço)
                    const inicioDescricao = j === 0 ? 0 : (precosSegmento[j-1].posicao + precosSegmento[j-1].preco.length);
                    const textoDescricao = segmento.substring(inicioDescricao, precoAtual.posicao).trim();
                    
                    // Limpar a descrição
                    let descricao = textoDescricao.replace(/\s*[-–]\s*$/, '').trim();
                    descricao = this.limparDescricao(descricao);
                    
                    if (descricao && descricao.length >= 3 && precoValor > 0) {
                        // Verificar qual NCM usar
                        let ncmParaProduto = null;
                        
                        // Se este é o último preço antes do NCM, usar o NCM atual
                        if (j === precosSegmento.length - 1 && i < todosNCMs.length) {
                            ncmParaProduto = ncmAtual.ncm;
                        } else if (ultimoNCM) {
                            // Se não, usar o último NCM encontrado (compartilhado)
                            ncmParaProduto = ultimoNCM;
                        }
                        
                        produtos.push({
                            descricao: descricao,
                            ncm: ncmParaProduto,
                            preco: precoValor,
                            origem: ncmParaProduto ? 'ncm_compartilhado' : 'sem_ncm'
                        });
                        
                        console.log(`✅ Produto: ${descricao.substring(0, 40)}... | R$ ${precoValor} | NCM: ${ncmParaProduto || 'Nenhum'}`);
                        
                        if (ncmParaProduto) {
                            ultimoNCM = ncmParaProduto;
                        }
                    }
                }
            }
            
            ultimaPosicao = ncmAtual.posicao + ncmAtual.ncm.length;
            ultimoNCM = ncmAtual.ncm;
        }
        
        // Verificar se há texto restante após o último NCM
        if (ultimaPosicao < texto.length) {
            const segmentoFinal = texto.substring(ultimaPosicao).trim();
            
            // Extrair preços do segmento final
            const precosFinal = [];
            let matchPreco;
            const regexPreco = /([\d]{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2})/g;
            
            while ((matchPreco = regexPreco.exec(segmentoFinal)) !== null) {
                precosFinal.push({
                    preco: matchPreco[0],
                    posicao: matchPreco.index
                });
            }
            
            // Para cada preço no final, criar produto com último NCM (se existir)
            for (let j = 0; j < precosFinal.length; j++) {
                const precoAtual = precosFinal[j];
                const precoStr = precoAtual.preco;
                const precoValor = this.converterParaNumero(precoStr);
                
                const inicioDescricao = j === 0 ? 0 : (precosFinal[j-1].posicao + precosFinal[j-1].preco.length);
                const textoDescricao = segmentoFinal.substring(inicioDescricao, precoAtual.posicao).trim();
                
                let descricao = this.limparDescricao(textoDescricao);
                
                // 🔥 NOVO: Se a descrição é muito curta (menos de 3 caracteres) ou é apenas um traço/palavra "ncm", usar o segmento antes do primeiro NCM
                if ((!descricao || descricao.length < 3) && todosNCMs.length > 0) {
                    const segmentoInicial = texto.substring(0, todosNCMs[0].posicao).trim();
                    descricao = segmentoInicial.replace(/\s*[-–]\s*$/, '').trim();
                    descricao = this.limparDescricao(descricao);
                }
                
                if (descricao && descricao.length >= 3 && precoValor > 0) {
                    produtos.push({
                        descricao: descricao,
                        ncm: ultimoNCM, // Usar o último NCM encontrado (compartilhado)
                        preco: precoValor,
                        origem: ultimoNCM ? 'ncm_compartilhado_final' : 'sem_ncm_final'
                    });
                    
                    console.log(`✅ Produto final: ${descricao.substring(0, 40)}... | R$ ${precoValor} | NCM: ${ultimoNCM || 'Nenhum'}`);
                }
            }
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Processar formato ESPECÍFICO da sua mensagem de computadores
    processarFormatoEspecificoComputadores(texto) {
        console.log(`🔍 Processando formato específico de computadores...`);
        
        // Formato: "DESC PREÇO NCM" (repetido) - SEM TRAÇO entre preço e NCM
        // Exemplo: "PLACA MAE ... -995,20 84719090 MEMORIA ... 1.697,00 85423190"
        
        // Primeiro, vamos adicionar separadores para facilitar o parsing
        let textoProcessado = texto;
        
        // Adicionar quebra de linha antes de cada NCM (8 dígitos)
        textoProcessado = textoProcessado.replace(/(\d{8})/g, '\n$1\n');
        
        // Adicionar quebra de linha antes de cada preço (formato 1.234,56)
        textoProcessado = textoProcessado.replace(/(\d{1,3}(?:\.\d{3})*,\d{1,2})/g, '\n$1\n');
        
        // Remover múltiplas quebras de linha
        textoProcessado = textoProcessado.replace(/\n+/g, '\n').trim();
        
        console.log(`📝 Texto processado:\n${textoProcessado}`);
        
        // Agora processar as linhas
        const linhas = textoProcessado.split('\n').map(l => l.trim()).filter(l => l);
        
        if (linhas.length < 3) return [];
        
        const produtos = [];
        let i = 0;
        
        while (i < linhas.length) {
            // Primeiro tentar encontrar um bloco de produto: DESC PREÇO NCM
            // Verificar se temos pelo menos 3 linhas disponíveis
            if (i + 2 < linhas.length) {
                const linha1 = linhas[i];
                const linha2 = linhas[i + 1];
                const linha3 = linhas[i + 2];
                
                // Verificar se linha2 é um preço e linha3 é um NCM
                const preco = this.extrairPreco(linha2);
                const ncm = this.extrairApenasNCM(linha3);
                
                if (preco > 0 && ncm) {
                    // Esta linha1 deve ser a descrição
                    let descricao = linha1.trim();
                    
                    // Remover qualquer traço final
                    descricao = descricao.replace(/\s*[-–]\s*$/, '').trim();
                    descricao = this.limparDescricao(descricao);
                    
                    if (descricao && descricao.length >= 3) {
                        produtos.push({
                            descricao: descricao,
                            ncm: ncm,
                            preco: preco,
                            origem: 'formato_computadores'
                        });
                        console.log(`✅ Produto ${produtos.length}: ${descricao.substring(0, 30)}... | R$ ${preco} | NCM: ${ncm}`);
                        i += 3;
                        continue;
                    }
                }
            }
            
            // Se não encontrou o padrão, avançar
            i++;
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Processar padrão com NCM no meio
    processarPadraoNCMNoMeio(texto) {
        console.log(`🔍 Processando padrão NCM no meio...`);
        
        const padrao = /(.+?)\s*[-–]\s*(\d{8})\s*[-–]\s*([\d.,]+)/g;
        
        const produtos = [];
        let match;
        
        while ((match = padrao.exec(texto)) !== null) {
            let descricao = match[1].trim();
            const ncm = match[2];
            const preco = this.converterParaNumero(match[3]);
            
            descricao = descricao.replace(/\s*[-–]\s*$/, '').trim();
            descricao = this.limparDescricao(descricao);
            
            if (descricao && descricao.length >= 3 && preco > 0 && ncm) {
                produtos.push({
                    descricao: descricao,
                    ncm: ncm,
                    preco: preco,
                    origem: 'padrao_ncm_no_meio'
                });
                console.log(`✅ Produto: ${descricao.substring(0, 40)}... | R$ ${preco} | NCM: ${ncm}`);
            }
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Processar linha única especial
    processarLinhaUnicaEspecial(texto) {
        console.log(`🔍 Processando linha única especial...`);
        
        // Primeiro tentar o formato específico
        const produtosEspecificos = this.processarFormatoEspecificoComputadores(texto);
        if (produtosEspecificos.length > 0) {
            return produtosEspecificos;
        }
        
        // Fallback: quebrar por NCMs
        const quebrasAdicionadas = texto.replace(/(\d{8})/g, '\n$1\n');
        const linhasQuebradas = quebrasAdicionadas.split('\n').map(l => l.trim()).filter(l => l);
        
        console.log(`📝 Após quebra por NCMs: ${linhasQuebradas.length} linhas`);
        
        if (linhasQuebradas.length >= 4) {
            return this.processarMultiplosProdutosComNMCSeparados(linhasQuebradas);
        }
        
        return [];
    }

    // 🔥 MÉTODO: Extrair múltiplos de uma linha
    extrairMultiplosDeUmaLinha(texto) {
        console.log(`🔍 Tentando extrair múltiplos produtos de uma linha...`);
        
        let textoComQuebras = texto.replace(/(\d{8})/g, '\n$1\n');
        textoComQuebras = textoComQuebras.replace(/\n+/g, '\n').trim();
        
        console.log(`📝 Texto com quebras artificiais:\n${textoComQuebras}`);
        
        const linhas = textoComQuebras.split('\n').map(l => l.trim()).filter(l => l);
        
        console.log(`🔍 Agora tem ${linhas.length} linhas após processamento`);
        
        return this.processarMultiplosProdutosComNMCSeparados(linhas);
    }

    // 🔥 MÉTODO: Formato específico do usuário
    processarFormatoEspecificoUsuario(texto) {
        console.log(`🔍 Processando formato específico do usuário...`);
        
        const padraoGeral = /(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2})\s+(\d{8})/g;
        
        const produtos = [];
        let match;
        
        while ((match = padraoGeral.exec(texto)) !== null) {
            let descricao = match[1].trim();
            const preco = this.converterParaNumero(match[2]);
            const ncm = match[3];
            
            descricao = descricao.replace(/\s*[-–]\s*$/, '').trim();
            descricao = this.limparDescricao(descricao);
            
            if (descricao && descricao.length >= 3 && preco > 0 && ncm) {
                produtos.push({
                    descricao: descricao,
                    ncm: ncm,
                    preco: preco,
                    origem: 'formato_usuario_linha_unica'
                });
                console.log(`✅ Produto: ${descricao.substring(0, 40)}... | R$ ${preco} | NCM: ${ncm}`);
            }
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Processar múltiplos produtos com NCMs separados
    processarMultiplosProdutosComNMCSeparados(linhas) {
        console.log(`🔍 Processando múltiplos produtos com NCMs separados (${linhas.length} linhas)...`);
        
        const produtos = [];
        let produtoAtual = null;
        
        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i];
            
            // Verificar se é NCM
            const ncm = this.extrairApenasNCM(linha);
            
            if (ncm && this.ehApenasNCM(linha)) {
                // Se temos produto atual, completar com NCM
                if (produtoAtual && produtoAtual.descricao && produtoAtual.preco > 0) {
                    produtoAtual.ncm = ncm;
                    produtoAtual.origem = 'multiplos_ncm_separados';
                    
                    if (produtoAtual.descricao.length < 5 && i > 0) {
                        const linhaAnterior = linhas[i-1];
                        let descricaoAlternativa = linhaAnterior;
                        const precoStr = produtoAtual.preco.toFixed(2).replace('.', ',');
                        descricaoAlternativa = descricaoAlternativa.replace(new RegExp('\\s*' + precoStr.replace('.', '\\.') + '\\s*$'), '');
                        descricaoAlternativa = this.limparDescricao(descricaoAlternativa);
                        
                        if (descricaoAlternativa && descricaoAlternativa.length > produtoAtual.descricao.length) {
                            produtoAtual.descricao = descricaoAlternativa;
                        }
                    }
                    
                    produtos.push(produtoAtual);
                    console.log(`✅ Produto ${produtos.length}: ${produtoAtual.descricao.substring(0, 30)}... | NCM: ${ncm}`);
                    produtoAtual = null;
                }
                continue;
            }
            
            // Verificar se tem preço
            const preco = this.extrairPreco(linha);
            
            if (preco > 0) {
                // Se já tem produto atual, adicionar
                if (produtoAtual && produtoAtual.descricao) {
                    produtoAtual.origem = 'multiplos_sem_ncm';
                    produtos.push(produtoAtual);
                }
                
                // Extrair descrição
                let descricao = this.extrairDescricaoCorretamente(linha, preco);
                
                if (descricao && descricao.length >= 3) {
                    produtoAtual = {
                        descricao: descricao,
                        preco: preco,
                        ncm: null,
                        origem: 'pendente_ncm'
                    };
                }
            }
        }
        
        // Adicionar último produto
        if (produtoAtual && produtoAtual.descricao) {
            if (!produtoAtual.ncm) {
                produtoAtual.origem = 'ultimo_sem_ncm';
            }
            
            produtos.push(produtoAtual);
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Extrair descrição corretamente
    extrairDescricaoCorretamente(linha, preco) {
        let posicaoPreco = -1;
        let precoStrEncontrado = '';
        
        for (const padrao of this.padroesPreco) {
            const match = linha.match(padrao);
            if (match) {
                precoStrEncontrado = match[0];
                posicaoPreco = linha.indexOf(precoStrEncontrado);
                break;
            }
        }
        
        if (posicaoPreco === -1) {
            precoStrEncontrado = preco.toFixed(2).replace('.', ',');
            posicaoPreco = linha.indexOf(precoStrEncontrado);
        }
        
        let descricao = linha;
        
        if (posicaoPreco !== -1) {
            descricao = linha.substring(0, posicaoPreco).trim();
        } else {
            descricao = descricao.replace(precoStrEncontrado, '');
        }
        
        descricao = descricao.replace(/R\$\s*/gi, '');
        descricao = descricao.replace(/CUSTO:?\s*/gi, '');
        descricao = descricao.replace(/\s*[-–]\s*$/g, '');
        descricao = descricao.replace(/\s+/g, ' ').trim();
        descricao = this.limparDescricao(descricao);
        
        return descricao;
    }

    // Método auxiliar para verificar se a linha é apenas NCM
    ehApenasNCM(linha) {
        const textoLimpo = linha.trim();
        if (/^\d{4,10}$/.test(textoLimpo)) return true;
        if (/^\d{4}\.\d{2}(\.\d{2})?$/.test(textoLimpo)) return true;
        if (/^\d{2}\.\d{2}\.\d{2}\.\d{2}$/.test(textoLimpo)) return true;
        return false;
    }

    // 🔥 MÉTODO: Processar formato alternado estrito
    processarFormatoAlternadoEstrito(linhas) {
        console.log(`🔍 Processando formato alternado estrito (${linhas.length} linhas)...`);
        const produtos = [];
        
        for (let i = 0; i < linhas.length; i += 2) {
            if (i + 1 >= linhas.length) break;
            
            const linhaDescPreco = linhas[i];
            const linhaNCM = linhas[i + 1];
            
            const ncm = this.extrairApenasNCM(linhaNCM);
            if (!ncm) continue;
            
            const preco = this.extrairPreco(linhaDescPreco);
            if (preco === 0) continue;
            
            let descricao = linhaDescPreco;
            let precoRemovido = false;
            for (const padrao of this.padroesPreco) {
                const match = linhaDescPreco.match(padrao);
                if (match) {
                    const precoStr = match[0];
                    descricao = descricao.replace(precoStr, '');
                    precoRemovido = true;
                    break;
                }
            }
            
            if (!precoRemovido) {
                const precoStr = preco.toFixed(2).replace('.', ',');
                descricao = descricao.replace(precoStr, '');
            }
            
            descricao = descricao.replace(/\s*[-–]\s*$/g, '');
            descricao = descricao.replace(/\s+/g, ' ').trim();
            descricao = this.limparDescricao(descricao);
            
            if (descricao && descricao.length >= 3) {
                produtos.push({
                    descricao: descricao,
                    ncm: ncm,
                    preco: preco,
                    origem: 'formato_alternado_estrito'
                });
                console.log(`✅ Produto ${produtos.length}: ${descricao.substring(0, 30)}...`);
            }
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Processar padrão alternado
    processarPadraoAlternado(linhas) {
        console.log(`🔍 Processando padrão alternado (${linhas.length} linhas)...`);
        const produtos = [];
        
        let i = 0;
        while (i < linhas.length) {
            const linhaAtual = linhas[i];
            
            const preco = this.extrairPreco(linhaAtual);
            const temPreco = preco > 0;
            
            if (temPreco) {
                if (i + 1 < linhas.length) {
                    const proximaLinha = linhas[i + 1];
                    const ncm = this.extrairNCM(proximaLinha);
                    
                    if (ncm && this.ehProvavelmenteNCM(proximaLinha, ncm)) {
                        const descricao = this.extrairDescricao(linhaAtual);
                        
                        if (descricao && descricao.length >= 3) {
                            produtos.push({
                                descricao: descricao,
                                ncm: ncm,
                                preco: preco,
                                origem: 'padrao_alternado'
                            });
                            console.log(`✅ Produto ${produtos.length}: ${descricao.substring(0, 30)}...`);
                            i += 2;
                            continue;
                        }
                    }
                }
            }
            
            i++;
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Processar múltiplos produtos com NCM apenas no primeiro
    processarMultiplosProdutosComNCMNoPrimeiro(linhas) {
        const produtos = [];
        let ncmCompartilhado = null;
        
        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i];
            
            const ncmLinha = this.extrairNCM(linha);
            if (ncmLinha) {
                ncmCompartilhado = ncmLinha;
            }
            
            const preco = this.extrairPreco(linha);
            if (preco === 0) continue;
            
            const ncmParaUsar = ncmLinha || ncmCompartilhado;
            
            let descricao = linha;
            
            if (ncmLinha) {
                descricao = descricao.replace(ncmLinha, '');
                descricao = descricao.replace(/NCM\s*[:]?\s*/gi, '');
            }
            
            if (preco > 0) {
                const precoStr = preco.toString().replace('.', ',');
                descricao = descricao.replace(new RegExp(precoStr.replace(/\./g, '\\.'), 'g'), '');
                descricao = descricao.replace(/R\$\s*[\d.,]+/gi, '');
                descricao = descricao.replace(/CUSTO:?\s*[\d.,]+/gi, '');
                descricao = descricao.replace(/[\d]{1,3}(?:\.\d{3})*,\d{1,2}/g, '');
                descricao = descricao.replace(/[\d]+,\d{1,2}/g, '');
            }
            
            descricao = descricao.replace(/\s*[-–]\s*/g, ' ');
            descricao = descricao.replace(/\s+/g, ' ').trim();
            descricao = this.limparDescricao(descricao);
            
            if (descricao && descricao.length >= 3) {
                produtos.push({
                    descricao: descricao,
                    ncm: ncmParaUsar,
                    preco: preco,
                    origem: ncmLinha ? 'linha_com_ncm' : 'linha_sem_ncm_compartilhado'
                });
            }
        }
        
        return produtos;
    }

    // 🔥 MÉTODO: Completar múltiplos produtos com contexto
    tentarCompletarMultiplosComContexto(texto, contexto) {
        const ncm = this.extrairNCM(texto);
        const preco = this.extrairPreco(texto);
        
        if (!ncm && preco === 0) return null;
        
        if (ncm && contexto.produtosPendentes.length > 0) {
            const todosSemNCM = contexto.produtosPendentes.every(p => !p.produto.ncm);
            if (todosSemNCM) {
                console.log(`🔗 Completando ${contexto.produtosPendentes.length} produtos com NCM: ${ncm}`);
                
                return contexto.produtosPendentes.map(pendente => ({
                    descricao: pendente.produto.descricao,
                    ncm: ncm,
                    preco: pendente.produto.preco,
                    origem: 'contexto_ncm_multiplos'
                }));
            }
        }
        
        return null;
    }

    extrairProdutoDeBloco(bloco) {
        const linhas = bloco.split('\n').map(l => l.trim()).filter(l => l);
        
        if (linhas.length === 3) {
            return this.extrairProdutoDe3Linhas(linhas);
        }
        
        if (linhas.length === 1) {
            return this.extrairProdutoDeLinha(linhas[0]);
        }
        
        return null;
    }

    ehProvavelmenteNCM(linha, ncmEncontrado) {
        if (linha.trim() === ncmEncontrado) return true;
        if (/^NCM:?\s*\d+/i.test(linha)) return true;
        
        if (ncmEncontrado.length >= 8 || ncmEncontrado.includes('.')) {
            const index = linha.indexOf(ncmEncontrado);
            const antes = linha.substring(0, index);
            const depois = linha.substring(index + ncmEncontrado.length);
            
            if ((!antes || /\D$/.test(antes)) && (!depois || /^\D/.test(depois))) {
                return true;
            }
        }
        
        return false;
    }

    extrairProdutoDeLinha(linha, ncmCompartilhado = null) {
        console.log(`🔍 Extraindo produto de linha única: "${linha.substring(0, 50)}..."`);
        
        // =========================================================================
        // 1. PADRÕES ESPECIAIS (Mantidos do seu código original)
        // =========================================================================

        // 🔥 PADRÃO ESPECIAL: Para capturar "DESC - ncm NCM - ncm PREÇO" (erro comum)
        const padraoNcmRepetido = /(.+?)\s*[-–]\s*ncm\s*[:]?\s*(\d{4,8}(?:\.\d{1,4}){0,2})\s*[-–]\s*ncm\s*[:]?\s*([\d.,]+)/i;
        const matchNcmRepetido = linha.match(padraoNcmRepetido);
        if (matchNcmRepetido) {
            const descricao = this.limparDescricao(matchNcmRepetido[1]);
            const ncm = matchNcmRepetido[2];
            const preco = this.converterParaNumero(matchNcmRepetido[3]);
            
            console.log(`✅ Padrão NCM repetido (erro) encontrado e corrigido: ${descricao.substring(0, 30)}...`);
            return {
                descricao: descricao,
                ncm: ncm,
                preco: preco,
                origem: 'ncm_repetido_corrigido'
            };
        }
        
        // 🔥 NOVO PADRÃO: Para capturar "DESC - ncm NCM - preço PREÇO" (com palavras "ncm" e "preço")
        const padraoDescNcmPrecoPalavras = /(.+?)\s*[-–]\s*ncm\s*[:]?\s*(\d{4,8}(?:\.\d{1,4}){0,2})\s*[-–]\s*pre[çc]o\s*[:]?\s*([\d.,]+)/i;
        const matchDescNcmPrecoPalavras = linha.match(padraoDescNcmPrecoPalavras);
        
        if (matchDescNcmPrecoPalavras) {
            const descricao = this.limparDescricao(matchDescNcmPrecoPalavras[1]);
            const ncm = matchDescNcmPrecoPalavras[2];
            const preco = this.converterParaNumero(matchDescNcmPrecoPalavras[3]);
            
            console.log(`✅ Padrão DESC-ncm-NCM-preço-PREÇO encontrado: ${descricao.substring(0, 30)}...`);
            return {
                descricao: descricao,
                ncm: ncm,
                preco: preco,
                origem: 'desc_ncm_preco_palavras'
            };
        }
        
        // 🔥 MELHORADO: Padrão para "DESC - NCM - PREÇO" com "NCM" na frente (case insensitive)
        const padraoDescNcmPrecoComNCM = /(.+?)\s*[-–]\s*ncm\s*[:]?\s*(\d{4,8}(?:\.\d{1,4}){0,2})\s*[-–]\s*(?:R\$\s*|pre[çc]o\s*[:]?\s*)?([\d.,]+)/i;
        const matchDescNcmPrecoComNCM = linha.match(padraoDescNcmPrecoComNCM);
        
        if (matchDescNcmPrecoComNCM) {
            const descricao = this.limparDescricao(matchDescNcmPrecoComNCM[1]);
            const ncm = matchDescNcmPrecoComNCM[2];
            const preco = this.converterParaNumero(matchDescNcmPrecoComNCM[3]);
            
            console.log(`✅ Padrão DESC-NCM-PREÇO (com NCM) encontrado: ${descricao.substring(0, 30)}...`);
            return {
                descricao: descricao,
                ncm: ncm,
                preco: preco,
                origem: 'desc_ncm_preco_com_ncm'
            };
        }
        
        // 🔥 Padrão para "DESC - NCM - PREÇO" (sem "NCM" na frente)
        const padraoDescNcmPreco = /(.+?)\s*[-–]\s*(\d{4,8}(?:\.\d{1,4}){0,2})\s*[-–]\s*(?:R\$\s*|pre[çc]o\s*[:]?\s*)?([\d.,]+)/i;
        const matchDescNcmPreco = linha.match(padraoDescNcmPreco);
        
        if (matchDescNcmPreco) {
            const descricao = this.limparDescricao(matchDescNcmPreco[1]);
            const ncm = matchDescNcmPreco[2];
            const preco = this.converterParaNumero(matchDescNcmPreco[3]);
            
            console.log(`✅ Padrão DESC-NCM-PREÇO encontrado: ${descricao.substring(0, 30)}...`);
            return {
                descricao: descricao,
                ncm: ncm,
                preco: preco,
                origem: 'desc_ncm_preco'
            };
        }
        
        // Padrão original para "DESC - PREÇO - NCM"
        const padraoCompleto = /(.+?)\s*[-–]\s*([\d.,]+)\s*[-–]\s*(\d{4,8}(?:\.\d{1,4}){0,2})/i;
        const matchCompleto = linha.match(padraoCompleto);
        
        if (matchCompleto) {
            const descricao = this.limparDescricao(matchCompleto[1]);
            const preco = this.converterParaNumero(matchCompleto[2]);
            const ncm = matchCompleto[3];
            
            console.log(`✅ Padrão completo encontrado: ${descricao.substring(0, 30)}...`);
            return {
                descricao: descricao,
                ncm: ncm,
                preco: preco,
                origem: 'linha_unica_completa'
            };
        }
        
        const padraoAlternativo = /(.+?)\s+ncm\s*[:]?\s*(\d{4,8}(?:\.\d{1,4}){0,2})\s*[-–]\s*(?:R\$\s*|pre[çc]o\s*[:]?\s*)?([\d.,]+)/i;
        const matchAlt = linha.match(padraoAlternativo);
        
        if (matchAlt) {
            const descricao = this.limparDescricao(matchAlt[1]);
            const ncm = matchAlt[2];
            const preco = this.converterParaNumero(matchAlt[3]);
            
            console.log(`✅ Padrão alternativo encontrado: ${descricao.substring(0, 30)}...`);
            return {
                descricao: descricao,
                ncm: ncm,
                preco: preco,
                origem: 'linha_unica_ncm_preco'
            };
        }

        // =========================================================================
        // 2. LÓGICA DE LIMPEZA INTELIGENTE (ATUALIZADA)
        // =========================================================================
        
        const ncm = this.extrairNCM(linha) || ncmCompartilhado;
        const preco = this.extrairPreco(linha);
        
        // Se não tem NCM e nem preço, tenta extrair só descrição como último recurso
        if (!ncm && preco === 0) {
            const descricao = this.extrairDescricao(linha);
            if (descricao && preco > 0) {
                return {
                    descricao: descricao,
                    ncm: null,
                    preco: preco,
                    origem: 'linha_unica_sem_ncm'
                };
            }
            return null;
        }
        
        let descricao = linha;
        
        // --- A. REMOÇÃO DO NCM ---
        if (ncm) {
            descricao = descricao.replace(ncm, '');
            // Remove labels de NCM que podem ter sobrado
            descricao = descricao.replace(/NCM\s*[:.]?\s*/gi, '');
        }
        
        // --- B. REMOÇÃO DO PREÇO (BLINDADA PARA PONTO DE MILHAR) ---
        if (preco > 0) {
            // 1. Remove R$ e CUSTO seguidos de números
            descricao = descricao.replace(/(?:R\$|CUSTO:?|PRE[ÇC]O:?)\s*[\d.,]+/gi, '');
            
            // 2. Remove o valor formatado com pontuação brasileira (Ex: 2.488,51)
            const valorFormatadoBR = preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            descricao = descricao.replace(valorFormatadoBR, '');
            
            // 3. Remove o valor formatado simples (Ex: 2488,51 - caso o regex acima falhe por formato diferente)
            const valorFormatadoSimples = preco.toFixed(2).replace('.', ',');
            descricao = descricao.replace(valorFormatadoSimples, '');

            // 4. Remove a parte inteira isolada se ela estiver no texto (Ex: remover "2.488" de "R 2.488")
            const parteInteira = Math.floor(preco);
            const parteInteiraFormatada = parteInteira.toLocaleString('pt-BR'); // "2.488"
            
            // Regex seguro: procura o número inteiro isolado (com fronteiras de palavra ou espaços)
            // Escapamos o ponto para o regex não confundir
            const regexInteiro = new RegExp(`(?:^|\\s|R\\$|R)${parteInteiraFormatada.replace(/\./g, '\\.')}(?:\\s|$)`, 'g');
            
            if (regexInteiro.test(descricao)) {
                 descricao = descricao.replace(regexInteiro, ' ');
            }
        }
        
        // --- C. LIMPEZA FINAL ---
        // Usa o limparDescricao atualizado para remover sobras como "R ", "-", etc.
        descricao = this.limparDescricao(descricao);
        
        if (!descricao || descricao.length < 3) return null;
        
        return {
            descricao: descricao,
            ncm: ncm,
            preco: preco,
            origem: 'linha_unica_limpeza_forcada'
        };
    }
}

class ValidadorProduto {
    validarProduto(produto) {
        const descValida = produto.descricao && produto.descricao.length >= 3;
        const ncmValido = produto.ncm && produto.ncm.length >= 4;
        const precoValido = produto.preco && produto.preco > 0 && produto.preco < 1000000;
        
        const aprovado = descValida && ncmValido && precoValido;
        
        return {
            aprovado: aprovado,
            dados: produto,
            motivo: aprovado ? 'Aprovado' : `Inválido: ${!descValida?'desc':''}${!ncmValido?' ncm':''}${!precoValido?' preço':''}`
        };
    }
}

module.exports = { ExtratorSimples, ValidadorProduto };
