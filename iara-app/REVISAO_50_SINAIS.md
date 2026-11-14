# Revisão do app IARA contra 50 sinais de "feito por IA"

A lista foi juntada de seis textos sobre o assunto (links no fim) e conferida no app, item por item, depois do redesenho de 14/11/2026.

Legenda: **corrigido** = havia e foi mudado; **ok** = não aparece no app; **mantido** = aparece de propósito, com o motivo.

## Cor e superfície
1. Roxo ou índigo como cor principal: **ok**. As cores são as do manual de marca (tinta, água, mata alagada).
2. Degradê roxo e azul: **ok**. Não há degradê.
3. Título com texto em degradê: **ok**.
4. Fundo creme "de bom gosto": **ok**. O fundo #EEF3EE é o do manual, verde-acinzentado e frio.
5. Verde-floresta com creme e letra serifada: **mantido em parte**. O verde vem da logo. Não há serifa, e o topo escuro com a faixa de mosaico afasta o app desse visual.
6. Brilho neon no tema escuro: **ok**.
7. Inter ou Geist sozinha, no peso padrão: **corrigido**. O texto passou de letra do sistema para Geist, e os títulos usam Bricolage 650 com espaçamento de -2,5%. É o par que o manual pede.
8. Instrument Serif ou Fraunces: **ok**.
9. Rótulo pequeno em caixa alta antes dos títulos: **ok**. Não há nenhum.
10. Números em fonte mono: **ok**. Os números usam algarismos tabulares da Geist.

## Layout
11. Capa centralizada com frase genérica e dois botões: **ok**. A tela inicial abre com o lugar da pessoa e o rio e o fogo de lá.
12. Três cartões iguais lado a lado: **mantido**. A grade de 3 por 3 da tela inicial é o padrão dos apps de governo, como o e-Título, e foi pedida. São 9 serviços reais, e não cartões de "vantagens".
13. O mesmo cartão repetido na página inteira: **corrigido**. Só a grade de serviços usa quadros. O resto são listas com linhas.
14. Espaços todos iguais: **corrigido**. Os títulos de seção têm mais espaço acima (30px) do que abaixo (8px). Os quadros têm 16px, e as listas não têm recuo.
15. Componentes shadcn sem mexer: **ok**. O app é feito à mão.
16. Cantos muito arredondados em tudo: **corrigido**. Tudo que se toca usa 6px. Só a folha de busca usa 12px, nos dois cantos de cima.
17. Botões em pílula: **ok**.
18. Sombra cinza nos cartões: **ok**. Não há sombra.
19. Borda colorida à esquerda dos cartões: **ok**. A versão anterior tinha faixas assim e elas saíram.
20. Faixa de texto correndo: **ok**.
21. Caixas dentro de caixas: **corrigido**. O quadro do lugar separa rio e fogo com linhas, sem caixa interna.
22. Tudo aparecendo com animação ao rolar: **ok**. A única animação é o aviso que some.
23. Cartões que crescem ao passar o mouse: **ok**.
24. Rolagem controlada pelo site: **ok**.

## Imagem e ícone
25. Imagem gerada por IA: **corrigido**. Entraram as imagens reais do radar NISAR em Manaus, na cheia e na seca, com satélite, banda e data, como o manual pede.
26. Foto de banco com gente sorrindo: **ok**.
27. Emoji como ícone: **ok**. Os ícones são todos de uma família só (Phosphor).
28. Emoji em título: **ok**.
29. Emoji como marcador de lista: **ok**.

## Texto
30. Muitos travessões: **corrigido**. Não há travessão, meia-risca, reticências ou "·" no app.
31. Frases de abertura prontas: **ok**.
32. Palavras da moda (solução, robusto, inovador, ecossistema): **ok**. Conferido por busca no código.
33. Verbos de efeito ("transforme", "potencialize"): **ok**.
34. Frase de abertura que serve para qualquer empresa: **ok**. A tela inicial diz o lugar, o nível do rio e o número de focos.
35. Texto cheio de "pode ajudar": **ok**. As instruções são diretas ("Ligue para o 193").
36. Sem dizer para quem é: **ok**. A descrição e o "Sobre" falam de comunidades ribeirinhas.
37. Nenhuma prova real: **ok**. Os números vêm da ANA e do INPE, com data, e a fonte está escrita no pé da tela.
38. Depoimentos inventados: **ok**. Não há depoimentos.

## Navegação
39. Menu genérico (Início, Serviços, Sobre, Contato): **corrigido**. As abas são Início, Rio, Fogo, Denunciar e Mais, tiradas do que a pessoa vai fazer.
40. Vários botões principais competindo: **corrigido**. A tela inicial tem um botão de destaque só, o de ligar 193.
41. Cada tela com uma promessa diferente: **ok**.
42. Conteúdo fixo fingindo ser dinâmico: **ok**. O que é fixo diz a data do boletim.

## Código e acessibilidade
43. Título e descrição repetidos: **ok**. O app é uma página só, com título e descrição próprios.
44. Sem imagem para compartilhar: **corrigido**. Entrou img/og.png, feita do banner da marca.
45. Texto alternativo ruim ou ausente: **corrigido**. As imagens do radar descrevem o que mostram. A logo tem "IARA", e a faixa de mosaico é decorativa.
46. Mais de um H1 ou níveis pulados: **corrigido**. Cada tela tem um H1 no topo. Na tela inicial ele fica escondido, para o leitor de tela.
47. Página vazia até o JavaScript rodar: **mantido em parte**. A grade de serviços, o botão 193 e as abas estão no HTML. Os números dependem do lugar e são calculados no celular.
48. Texto estourando ou desalinhado: **corrigido**. Conferido em tela de 412px no tema claro e no escuro, com letra normal e grande.
49. Sem contorno de foco: **ok**. Tudo que se toca ganha contorno azul de 3px no foco.
50. Imagens que empurram o layout ao carregar: **ok**. Todas as imagens têm largura e altura.

## Fontes da lista
- https://jc-aiwiki.pages.dev/ai-web-design/unslop-ui
- https://claudecodehq.com/playbooks/unslop-ui
- https://www.utsubo.com/blog/built-with-ai-trust-signals-2026
- https://robotsonpayroll.substack.com/p/how-to-avoid-that-vibe-coded-look
- https://htmlpub.com/blog/claude-marketing-website-vs-landing-page-giveaways
- https://northeasttimes.com/2026/07/31/ai-design-tools-are-making-every-website-look-the-same/
