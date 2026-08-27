'use strict';

/**
 * Minimal multipart/form-data parser (buffer based, no dependencies).
 * Enough for the admin panel's image uploads.
 *
 *   const { fields, files } = parseMultipart(bodyBuffer, boundary);
 *   files.imageFiles => [ { filename, type, data:<Buffer> }, ... ]   (always an array)
 */

function parseMultipart(body, boundary) {
  const out = { fields: {}, files: {} };
  if (!Buffer.isBuffer(body) || !boundary) return out;

  const bnd = Buffer.from('--' + boundary);
  let idx = body.indexOf(bnd);
  if (idx < 0) return out;
  idx += bnd.length;

  while (idx < body.length) {
    // "--" right after a boundary marks the end
    if (body[idx] === 0x2d && body[idx + 1] === 0x2d) break;
    // skip the CRLF after the boundary
    if (body[idx] === 0x0d && body[idx + 1] === 0x0a) idx += 2;

    const headerEnd = body.indexOf('\r\n\r\n', idx, 'latin1');
    if (headerEnd < 0) break;
    const headers = body.slice(idx, headerEnd).toString('utf8');
    const contentStart = headerEnd + 4;

    const nextBnd = body.indexOf(bnd, contentStart);
    if (nextBnd < 0) break;
    // content is followed by CRLF then the next boundary
    const content = body.slice(contentStart, nextBnd - 2);

    const nameM = /name="([^"]*)"/i.exec(headers);
    const fileM = /filename="([^"]*)"/i.exec(headers);
    const typeM = /content-type:\s*([^\r\n]+)/i.exec(headers);
    const name = nameM ? nameM[1] : '';

    if (name) {
      if (fileM && fileM[1]) {
        (out.files[name] = out.files[name] || []).push({
          filename: fileM[1],
          type: typeM ? typeM[1].trim() : 'application/octet-stream',
          data: content,
        });
      } else if (name in out.fields) {
        // repeated non-file field -> array
        out.fields[name] = [].concat(out.fields[name], content.toString('utf8'));
      } else {
        out.fields[name] = content.toString('utf8');
      }
    }
    idx = nextBnd + bnd.length;
  }
  return out;
}

module.exports = { parseMultipart };
