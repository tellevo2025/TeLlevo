/*
  netlify/functions/reserva.js
  Proxy seguro hacia Google Apps Script.
  La URL del script se lee desde la variable de entorno APPSCRIPT_URL,
  nunca queda expuesta en el código del cliente.
*/

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const scriptUrl = process.env.APPSCRIPT_URL
    || 'https://script.google.com/macros/s/AKfycbxz8ZOyxd9kXeG-c-FqJTPIbI8Phgj2XoHmD1Eo5Aznvb2VoObiiZMgtvZ-ygl-olxe/exec';

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: event.body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'follow',
    });

    const text = await response.text();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: text.trim(),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: '❌ Error al procesar la reserva: ' + error.message,
    };
  }
};
