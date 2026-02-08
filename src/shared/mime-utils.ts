import type { EmailAttachmentInfo } from './types';

/**
 * RFC 2047 encoded-word decoder (=?charset?encoding?text?=)
 */
function decodeRfc2047(value: string): string {
    return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, _charset, encoding, text) => {
        if (encoding.toUpperCase() === 'B') {
            try {
                return atob(text);
            } catch {
                return text;
            }
        }
        // Q-encoding
        return text
            .replace(/_/g, ' ')
            .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    });
}

/**
 * Extract a parameter value from a MIME header (e.g. filename="doc.pdf" or name="doc.pdf").
 * Handles quoted and unquoted values.
 */
function extractHeaderParam(header: string, param: string): string {
    // RFC 2231 encoded parameter (e.g. filename*=UTF-8''doc.pdf)
    const encRe = new RegExp(`${param}\\*\\s*=\\s*[^']*'[^']*'([^;\\s]+)`, 'i');
    const encMatch = encRe.exec(header);
    if (encMatch) {
        try {
            return decodeURIComponent(encMatch[1]);
        } catch {
            return encMatch[1];
        }
    }
    // Standard quoted or unquoted
    const re = new RegExp(`${param}\\s*=\\s*"([^"]*)"`, 'i');
    const match = re.exec(header);
    if (match) return decodeRfc2047(match[1]);
    const reUnquoted = new RegExp(`${param}\\s*=\\s*([^;\\s]+)`, 'i');
    const matchUnquoted = reUnquoted.exec(header);
    if (matchUnquoted) return decodeRfc2047(matchUnquoted[1]);
    return '';
}

/**
 * Estimate decoded size from base64-encoded content length.
 */
function estimateBase64Size(encodedLength: number): number {
    return Math.floor((encodedLength * 3) / 4);
}

/**
 * Parse attachment info from raw RFC 2822 email source.
 * Extracts filename, estimated size, and MIME type for each attachment part.
 */
export function parseAttachmentsFromRaw(raw: string): EmailAttachmentInfo[] {
    if (!raw) return [];

    const results: EmailAttachmentInfo[] = [];

    // Find boundary from top-level Content-Type
    const boundaryMatch = /^Content-Type:\s*multipart\/[^;]*;[^\n]*boundary\s*=\s*"?([^\s";\n]+)"?/im.exec(raw);
    if (!boundaryMatch) return [];

    const boundary = boundaryMatch[1];
    const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?\r?\n`));

    // Skip the first part (preamble before first boundary)
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part.trim()) continue;

        // Split headers from body at first blank line
        const headerEndIdx = part.search(/\r?\n\r?\n/);
        if (headerEndIdx < 0) continue;
        const headerBlock = part.substring(0, headerEndIdx);
        const bodyBlock = part.substring(headerEndIdx).replace(/^\r?\n\r?\n/, '');

        // Unfold headers (continuation lines)
        const unfoldedHeaders = headerBlock.replace(/\r?\n[ \t]+/g, ' ');

        const contentType = unfoldedHeaders.match(/^Content-Type:\s*(.+)/im)?.[1] || '';
        const disposition = unfoldedHeaders.match(/^Content-Disposition:\s*(.+)/im)?.[1] || '';
        const transferEncoding = unfoldedHeaders.match(/^Content-Transfer-Encoding:\s*(\S+)/im)?.[1] || '';

        // Recurse into nested multipart
        if (/^multipart\//i.test(contentType.trim())) {
            const nestedBoundary = extractHeaderParam(contentType, 'boundary');
            if (nestedBoundary) {
                const nestedRaw = `Content-Type: ${contentType}\n\n${bodyBlock}`;
                results.push(...parseAttachmentsFromRaw(nestedRaw));
            }
            continue;
        }

        // Determine if this part is an attachment
        const isAttachment = /^attachment/i.test(disposition.trim());
        const filename = extractHeaderParam(disposition, 'filename') || extractHeaderParam(contentType, 'name');

        if (!isAttachment && !filename) continue;

        // Skip inline text parts without filename
        const mimeType = contentType.split(';')[0].trim() || 'application/octet-stream';
        if (!filename && /^text\/(plain|html)$/i.test(mimeType)) continue;

        // Estimate size from body content
        let size = 0;
        if (/^base64$/i.test(transferEncoding.trim())) {
            const stripped = bodyBlock.replace(/[\s\r\n]/g, '');
            size = estimateBase64Size(stripped.length);
        } else {
            size = bodyBlock.length;
        }

        results.push({
            filename: filename || 'attachment',
            size,
            mimeType,
        });
    }

    return results;
}
