// Pergunta ao usuário quantos jogos deseja adicionar
let quantidadeJogos = parseInt(gets());

// TODO: Inicializa o array para armazenar os nomes dos jogos
let nomesJogos = [];

// TODO: Crie um loop para adicionar jogos conforme a quantidade especificada
for (let i = 0; i < quantidadeJogos; i++) {
    adicionarJogo(nomesJogos);
}

// Exibe o resumo da adição de jogos
exibirResumoAdicaoJogos(quantidadeJogos, nomesJogos);

// TODO: Crie uma função adicionarJogo
function adicionarJogo(nomesJogos) {
    let nomeJogo = gets();
    nomesJogos.push(nomeJogo);
}

function exibirResumoAdicaoJogos(quantidadeJogos, nomes) {
    print(`Foi adicionado '${quantidadeJogos}' jogos: ${nomes.join(", ")} ao catalogo.`);
}
