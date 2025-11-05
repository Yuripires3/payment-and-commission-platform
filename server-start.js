#!/usr/bin/env node

const os = require('os');

// Função para obter o IP real da máquina (prioriza IPs não-internos)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  // Coletar todos os IPs não-internos
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar IPv6 e interfaces internas (loopback)
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  
  // Priorizar IPs que não são 172.x.x.x ou 192.168.x.x (IPs públicos primeiro)
  const publicIPs = ips.filter(ip => !ip.startsWith('172.') && !ip.startsWith('192.168.'));
  if (publicIPs.length > 0) {
    return publicIPs[0];
  }
  
  // Se não houver IP público, usar o primeiro IP privado
  if (ips.length > 0) {
    return ips[0];
  }
  
  // Fallback para 0.0.0.0
  return '0.0.0.0';
}

// Forçar o hostname a 0.0.0.0 antes de iniciar o servidor (para escutar em todas as interfaces)
const listenHost = '0.0.0.0';
process.env.HOSTNAME = listenHost;
process.env.HOST = listenHost;
process.env.PORT = process.env.PORT || '3005';

// Obter IP real para exibição
const displayIP = getLocalIP();

// PATCH CRÍTICO: Substituir os.hostname() para SEMPRE retornar o IP real
// Isso faz o Next.js usar o IP ao invés do hostname do container
const originalHostname = os.hostname;
Object.defineProperty(os, 'hostname', {
  value: function() {
    return displayIP;
  },
  writable: false,
  configurable: false
});

// Também patchear require('os').hostname() caso seja chamado de forma diferente
// Limpar cache do módulo os para forçar recarregamento com nosso patch
delete require.cache[require.resolve('os')];
const patchedOs = require('os');
Object.defineProperty(patchedOs, 'hostname', {
  value: function() {
    return displayIP;
  },
  writable: false,
  configurable: false
});

// Garantir que o módulo original também seja patcheado
if (originalHostname) {
  Object.defineProperty(originalHostname, 'toString', {
    value: function() {
      return displayIP;
    }
  });
}

// Função para substituir QUALQUER hostname pelo IP real
function replaceHostname(message) {
  if (typeof message === 'string') {
    // Substituir hostname do container - padrões específicos
    // Padrão 1: http://c4f743f0f07c:3005 (12 caracteres hex)
    // Padrão 2: http://304c227fc8ae:3005 (12 caracteres hex)
    // Padrão 3: Qualquer hex de 8-12 caracteres
    // Padrão 4: Qualquer string alfanumérica que não seja IP válido
    return message
      // Padrão específico: http://hostname:port (ex: http://c4f743f0f07c:3005)
      .replace(/http:\/\/([a-f0-9]{8,12}):(\d+)/gi, `http://${displayIP}:$2`)
      .replace(/http:\/\/([a-f0-9]{8,12})/gi, `http://${displayIP}`)
      // Padrão genérico: qualquer hex seguido de porta
      .replace(/http:\/\/[a-f0-9]+:\d+/gi, `http://${displayIP}:${process.env.PORT}`)
      .replace(/http:\/\/[a-f0-9]+/gi, `http://${displayIP}`)
      // Padrão genérico: qualquer string que não seja IP válido após http://
      .replace(/http:\/\/(?!\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})([a-zA-Z0-9-]+):(\d+)/g, `http://${displayIP}:$2`)
      .replace(/http:\/\/(?!\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})([a-zA-Z0-9-]+)/g, `http://${displayIP}`)
      // Padrão adicional: capturar hostname sozinho (sem http://)
      .replace(/([a-f0-9]{8,12}):(\d+)/gi, `${displayIP}:$2`);
  }
  return message;
}

// Interceptar process.stdout.write (usado pelo Next.js para logs)
// IMPORTANTE: Fazer isso ANTES de carregar o Next.js
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk, encoding, callback) {
  if (typeof chunk === 'string') {
    chunk = replaceHostname(chunk);
    return originalStdoutWrite(chunk, encoding, callback);
  } else if (Buffer.isBuffer(chunk)) {
    const str = chunk.toString('utf8');
    const replaced = replaceHostname(str);
    if (str !== replaced) {
      chunk = Buffer.from(replaced, 'utf8');
    }
    return originalStdoutWrite(chunk, encoding, callback);
  }
  return originalStdoutWrite(chunk, encoding, callback);
};

// Interceptar process.stderr.write
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = function(chunk, encoding, callback) {
  if (typeof chunk === 'string') {
    chunk = replaceHostname(chunk);
    return originalStderrWrite(chunk, encoding, callback);
  } else if (Buffer.isBuffer(chunk)) {
    const str = chunk.toString('utf8');
    const replaced = replaceHostname(str);
    if (str !== replaced) {
      chunk = Buffer.from(replaced, 'utf8');
    }
    return originalStderrWrite(chunk, encoding, callback);
  }
  return originalStderrWrite(chunk, encoding, callback);
};

// Interceptar métodos de console também (para garantir)
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

// Log de inicialização para debug
console.log(`🚀 Starting server with IP: ${displayIP}, listening on: ${listenHost}:${process.env.PORT}`);
console.log(`📡 os.hostname() will return: ${os.hostname()}`);

// PATCH FINAL: Interceptar qualquer acesso ao hostname antes do Next.js carregar
// Isso garante que mesmo que o Next.js tenha uma referência antiga, ela será substituída
const originalHostnameValue = os.hostname();
if (originalHostnameValue !== displayIP) {
  console.log(`⚠️  Original hostname was: ${originalHostnameValue}, now patched to: ${displayIP}`);
}

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



