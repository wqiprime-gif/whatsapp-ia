function gerarCPFValido() {
    function gerarNumeroAleatorio(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function calcularPrimeiroDigito(cpfBase) {
      let soma = 0;
      let multiplicadores = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  
      for (let i = 0; i < cpfBase.length; i++) {
        soma += cpfBase[i] * multiplicadores[i];
      }
  
      let resto = soma % 11;
      if (resto <= 1) {
        return 0;
      } else {
        return 11 - resto;
      }
    }
  
    function calcularSegundoDigito(cpfBase, primeiroDigito) {
      let soma = 0;
      let multiplicadores = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  
      for (let i = 0; i < cpfBase.length; i++) {
        soma += cpfBase[i] * multiplicadores[i];
      }
      soma += primeiroDigito * multiplicadores[9];
  
      let resto = soma % 11;
      if (resto <= 1) {
        return 0;
      } else {
        return 11 - resto;
      }
    }
  
    let cpfBase = [];
    for (let i = 0; i < 9; i++) {
      cpfBase.push(gerarNumeroAleatorio(0, 9));
    }
  
    const primeiroDigito = calcularPrimeiroDigito(cpfBase);
    const segundoDigito = calcularSegundoDigito(cpfBase, primeiroDigito);

    const cpf = `${cpfBase.join('')}${primeiroDigito}${segundoDigito}`;
  

    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
module.exports = gerarCPFValido;