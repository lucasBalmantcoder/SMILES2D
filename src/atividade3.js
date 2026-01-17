const itens = [];

//TODO: Solicite os itens ao usuário
for (let i = 0; i < 3; i++) {
    const item = gets();
    itens.push(item);
}


// Exibe a lista de itens
print("Lista de itens:");
for (let i = 0; i < itens.length; i++) {
  print(`- ${itens[i]}`);
}