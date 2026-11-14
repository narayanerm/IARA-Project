# IARA, o app

App para comunidades ribeirinhas da Amazônia. Funciona no navegador do celular, instalado como app (PWA) ou como APK de Android. Depois de aberto uma vez, funciona sem internet.

## O que tem

- **Início**: o lugar da pessoa com o nível do rio e o fogo de lá, o botão de ligar 193 e uma grade de 9 serviços, como nos apps de governo.
- **Rio**: régua da estação escolhida, comparação com a cota de seca e de cheia, as 12 estações do boletim da ANA.
- **Fogo**: radar dos focos do INPE em volta de você (10, 30 ou 50 km), de junho a novembro, risco de fogo e alertas de desmatamento.
- **Denunciar**: 8 situações (fogo, desmatamento, garimpo, pesca ilegal, invasão, violência, óleo na água, órgão público), com o que fazer e o canal oficial de cada uma; telefones; anotações guardadas no celular.
- **Mais**: 4 guias que abrem sem internet (cheia, seca, fumaça, fogo), cursos gratuitos (EV.G, Defesa Civil, Enap, Embrapa, Senar), páginas da Funai, benefícios (seguro-defeso, Bolsa Verde) e ajustes (tema, letra maior).

A localização fica só no celular. O app não manda nada para servidor nenhum.

O visual segue o Manual de Marca IARA. A conferência contra 50 sinais de site feito por IA está em REVISAO_50_SINAIS.md.

## Testar no celular sem instalar nada

1. Abra https://app.netlify.com/drop no computador.
2. Arraste a pasta `www` para a página.
3. Abra o endereço que aparece no celular. No Chrome, toque nos três pontinhos e em "Instalar app".

## Gerar o APK de Android

Precisa de Node.js 20 ou mais novo e do Android Studio.

```
npm install
npm run android:criar     (só na primeira vez)
npm run android           (abre o Android Studio)
```

No Android Studio: Build, Build App Bundle(s) / APK(s), Build APK(s). O arquivo sai em `android/app/build/outputs/apk/debug/`.

## Atualizar os dados

- **Rio**: em `www/js/base.js`, troque `DATA_RIO`, `FONTE_RIO` e os números de cada estação (`cm` hoje, `ontem`, `d4` quatro dias antes) pelo boletim novo da ANA.
- **Fogo, desmatamento e territórios**: rode `python ferramentas/gerar_dados.py ../site_amazonia/dados_mapa`. Ele lê as camadas do site e grava `www/dados/*.js`.
- Depois de qualquer mudança em `www`, rode `node ferramentas/gerar_sw.mjs` para o app guardar a versão nova no celular.

## Fontes

ANA (boletim de monitoramento dos reservatórios e rios da Amazônia, 13/11/2026), INPE (Programa Queimadas e DETER), Funai e ICMBio (limites de territórios). O risco de fogo é um índice calculado pela equipe IARA e não é previsão oficial.
