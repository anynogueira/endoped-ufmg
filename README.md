# 🦷 Endoped UFMG — Pastas Obturadoras

> Aplicativo web progressivo (PWA) de apoio à decisão clínica para escolha de materiais obturadores em tratamento endodôntico de **dentes decíduos**, desenvolvido pela equipe de Odontopediatria e Endodontia Pediátrica (EndoPed) da Faculdade de Odontologia da UFMG.

## 📋 Sobre o Projeto

O **Endoped UFMG** é um fluxograma interativo que guia o profissional de odontologia na escolha da pasta obturadora mais adequada, considerando:

- **Tipo de dente** — Anterior ou Posterior
- **Integridade da coroa** — Coroa íntegra ou comprometida
- **Proximidade da esfoliação** — Se o dente está próximo da troca natural
- **Presença de lesão** — Lesão periapical ou interradicular
- **Curativo de demora** — Necessidade de Hidróxido de Cálcio prévio
- **Comprimento de trabalho** — Se atingiu toda a extensão das raízes

Ao final, o app recomenda materiais obturadores com indicador de custo relativo ($ a $$$), como **Vitapex**, **Endoflas**, **OZE**, **Guedes-Pinto** e **Hidróxido de cálcio espessada com óxido de zinco**.

## 🏗️ Arquitetura

O projeto é uma **Single Page Application (SPA)** vanilla, sem frameworks ou bundlers, otimizada para dispositivos móveis e instalável como PWA.

```
endoped-ufmg/
├── index.html             # Estrutura das telas (início, instruções, pergunta, resultado)
├── style.css              # Design system completo (variáveis, componentes, responsividade)
├── app.js                 # Motor do fluxograma e lógica de navegação
├── flow.json              # Árvore de decisão clínica (estrutura de nós e arestas)
├── sw.js                  # Service Worker para cache offline
├── manifest.json          # Manifesto PWA (ícones, cores, metadados)
├── assets/                # Logotipos e imagens clínicas
│   ├── logo-fao.png
│   ├── logo-endoped.png
│   ├── logo-odontopediatria.png
│   ├── anterior_*.png     # Imagens de referência - dentes anteriores
│   ├── posterior*.png      # Imagens de referência - dentes posteriores
│   └── appstore-images/   # Ícones para instalação (Android/iOS)
├── analyze.py             # Script utilitário: análise de $ref no flow.json
├── fix_flow.py            # Script utilitário: reordenação de arestas e correção de referências
├── insert_image.py        # Script utilitário: inserção de imagens nos nós do fluxograma
├── flow.json.bak          # Backup do flow.json
└── flow_with_image.json   # Versão alternativa do flow com imagens
```

### Fluxo de Telas

```
[Tela Inicial] → [Instruções] → [Perguntas (loop)] → [Recomendação]
```

1. **Tela Inicial** — Apresentação com logos institucionais e botão "Instruções"
2. **Instruções** — Orientação para seguir o fluxograma clínico
3. **Perguntas** — Navegação interativa pela árvore de decisão (com botão "Voltar")
4. **Resultado** — Lista de materiais recomendados com indicador de custo

### Modelo de Dados (`flow.json`)

A árvore de decisão é representada como um grafo dirigido em JSON:

```jsonc
{
  "text": "Tipo de Dente",      // Texto exibido na pergunta
  "id": "node-1",               // Identificador único do nó
  "type": "NODE",               // Tipo do nó
  "edges": [                    // Opções de resposta
    {
      "text": "Anterior",        // Texto do botão
      "image": "assets/...",     // Imagem opcional (referência clínica)
      "to": { ... }             // Próximo nó (inline ou $ref)
    }
  ]
}
```

- **Nós folha** (sem `edges`) representam o resultado/recomendação final
- **`$ref`** — Referências JSON Pointer para reutilização de subárvores (ex: `"$ref": "#/edges/0/to/..."`)
- **Custo** — Indicado no texto do resultado com `$`, `$$` ou `$$$`

## 🚀 Como Executar

O projeto é puramente estático — basta servir os arquivos com qualquer servidor HTTP:

```bash
# Com Python
python3 -m http.server 8000

# Com Node.js (npx)
npx -y serve .

# Com PHP
php -S localhost:8000
```

Acesse `http://localhost:8000` no navegador.

> **Nota:** Abrir `index.html` diretamente (`file://`) não funcionará corretamente porque o `fetch('flow.json')` requer um servidor HTTP.

## 📱 PWA (Progressive Web App)

O app pode ser instalado em dispositivos móveis e desktops:

- **Service Worker** (`sw.js`) — Cache-first strategy para funcionamento offline
- **Manifesto** (`manifest.json`) — Metadados para instalação (ícones, nome, cores)
- **Botão "Instalar App"** — Aparece automaticamente quando o navegador detecta o PWA

### Cache

O Service Worker cacheia automaticamente os recursos essenciais e usa a estratégia *cache-first* com fallback para rede. Para forçar atualização, incremente a versão em `CACHE_NAME` no `sw.js`.

## 🔧 Scripts Utilitários (Python)

Scripts auxiliares para manipulação do `flow.json`:

| Script | Descrição |
|---|---|
| `analyze.py` | Analisa referências `$ref` no fluxograma e identifica nós sem ID |
| `fix_flow.py` | Reordena arestas (Sim/Anterior primeiro) e recalcula paths de `$ref` |
| `insert_image.py` | Insere imagens clínicas em arestas específicas do fluxograma |

```bash
# Executar análise
python3 analyze.py

# Corrigir e reordenar fluxo (cria backup automático)
python3 fix_flow.py

# Inserir imagens
python3 insert_image.py
```

## 🎨 Design System

O projeto utiliza um design system minimalista e elegante baseado em variáveis CSS:

- **Tipografia** — Montserrat (Google Fonts), pesos 400–800
- **Paleta de cores** — Tons dourados/amarelos (`#f2d871`, `#dfc268`) sobre fundo off-white (`#fcfbfa`)
- **Componentes** — Cards com bordas suaves, botões pill, animações de fade/scale
- **Responsivo** — Mobile-first com ajustes para desktop (≥768px)

## 🏛️ Instituições

- **FAO** — Faculdade de Odontologia da UFMG
- **EndoPed UFMG** — Grupo de Endodontia Pediátrica
- **Odontopediatria UFMG** — Departamento de Odontopediatria e Ortodontia

## 📄 Licença

Este projeto é de uso acadêmico e clínico, vinculado à UFMG.