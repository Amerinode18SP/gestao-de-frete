const fs = require('fs');

const path = "C:\\Users\\Ana\\OneDrive - Amerinode do Brasil\\Compras\\AP GESTAO DE FRETE\\gestao-de-frete\\src\\app\\api\\ctes\\route.ts";

let content = fs.readFileSync(path, 'utf8');

// Adicionar filtro para excluir números com ponto (CPF/CNPJ) após os filtros existentes
content = content.replace(
  `.not('numero_cte', 'ilike', '%credito%')`,
  `.not('numero_cte', 'ilike', '%credito%')
    .not('numero_cte', 'ilike', '%.%')
    .not('numero_cte', 'ilike', '%/%')`
);

fs.writeFileSync(path, content, 'utf8');
console.log('✅ Filtro de CPF/CNPJ adicionado com sucesso!');
