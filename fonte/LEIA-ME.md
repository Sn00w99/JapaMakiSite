# Dados de origem

O conteúdo deste site foi extraído da API que alimenta o cardápio
digital da casa (`delivery-api.saipos.com/v1`), não copiado da tela.

| arquivo | o que é |
|---|---|
| `api-store.json` | resposta de `GET /stores?filter={"domain_name":"japamaki.saipos.com"}` — endereço, horários, meios de pagamento, taxa mínima, logo |
| `api-menu.json` | resposta de `GET /stores/1986/sales/view-data` — os 313 itens do cardápio com preços, descrições e variações |
| `fotos/` | as 74 fotos de prato que existem no acervo, no tamanho original |
| `logo-original.jpg` | a logo como está no sistema (150×150) — origem da paleta |
| `CARDAPIO-original.md` | o cardápio completo em texto, como saiu da API, antes de qualquer tratamento |

## Como atualizar quando o cardápio mudar

```sh
# 1. baixe a resposta da API de novo
curl "https://delivery-api.saipos.com/v1/stores?filter=%7B%22domain_name%22%3A%22japamaki.saipos.com%22%2C%22is_table_module%22%3Afalse%7D" -o fonte/api-store.json
curl "https://delivery-api.saipos.com/v1/stores/1986/sales/view-data?data=%7B%22saleModule%22%3A%22DELIVERY%22%2C%22idStoreSiteData%22%3A0%7D" -o fonte/api-menu.json

# 2. se houver fotos novas, jogue em fonte/fotos/ e processe
npm run imagens

# 3. reconstrua
npm run build

# 4. se o cardápio mudou de tamanho, remeça as alturas e reconstrua
npm run alturas && npm run build
```

`api-store.json` traz `id_store: 1986` — é ele que aparece na URL do
cardápio.
