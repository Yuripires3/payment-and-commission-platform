#!/usr/bin/env node

// Função para obter o IP real da máquina
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar IPv6 e interfaces internas
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  // Fallback para localhost se não encontrar IP externo
  return '0.0.0.0';
}

// Forçar o hostname a 0.0.0.0 antes de iniciar o servidor (para escutar em todas as interfaces)
const listenHost = '0.0.0.0';
process.env.HOSTNAME = listenHost;
process.env.HOST = listenHost;
process.env.PORT = process.env.PORT || '3005';

// Obter IP real para exibição
const displayIP = getLocalIP();

// Função para substituir hostname do container pelo IP real
function replaceHostname(message) {
  if (typeof message === 'string') {
    // Substituir hostname do container (hex) pelo IP real
    return message
      .replace(/http:\/\/[a-f0-9]{12}:\d+/g, `http://${displayIP}:${process.env.PORT}`)
      .replace(/http:\/\/[a-f0-9]{12}/g, `http://${displayIP}`)
      .replace(/http:\/\/[a-f0-9]+:\d+/g, `http://${displayIP}:${process.env.PORT}`)
      .replace(/http:\/\/[a-f0-9]+/g, `http://${displayIP}`);
  }
  return message;
}

// Interceptar métodos de console para substituir o hostname na mensagem do Next.js
const originalLog = console.log;
const originalInfo = console.info;

console.log = function(...args) {
  const modifiedArgs = args.map(arg => 
    typeof arg === 'string' ? replaceHostname(arg) : arg
  );
  originalLog.apply(console, modifiedArgs);
};

console.info = function(...args) {
  const modifiedArgs = args.map(arg => 
    typeof arg === 'string' ? replaceHostname(arg) : arg
  );
  originalInfo.apply(console, modifiedArgs);
};

// Iniciar o servidor standalone
// No container, o server.js está na raiz porque copiamos .next/standalone para ./
try {
  require('./server.js');
} catch (e) {
  console.error('Error loading server.js:', e.message);
  console.error('Trying alternative path...');
  // Tentar caminho alternativo caso o server.js não esteja na raiz
  try {
    require('.next/standalone/server.js');
  } catch (e2) {
    console.error('Error loading .next/standalone/server.js:', e2.message);
    process.exit(1);
  }
}

