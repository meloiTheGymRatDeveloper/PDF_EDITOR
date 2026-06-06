<?php
namespace App\Models;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;

class FileModel
{
    private const BLOB_API = 'https://blob.vercel-storage.com';

    public function __construct(
        private string $token,
        private Client $http
    ) {}

    public static function fromEnv(): self
    {
        return new self(
            $_ENV['BLOB_READ_WRITE_TOKEN'],
            new Client()
        );
    }

    public function upload(string $uuid, string $bytes, string $mimeType = 'application/pdf'): string
    {
        $ext      = ($mimeType === 'application/zip') ? 'zip' : 'pdf';
        $filename = "pending_{$uuid}.{$ext}";

        $res = $this->http->put(self::BLOB_API . '/' . $filename, [
            'headers' => [
                'Authorization'    => "Bearer {$this->token}",
                'Content-Type'     => $mimeType,
                'x-content-type'   => $mimeType,
            ],
            'body' => $bytes,
        ]);

        $data    = json_decode((string) $res->getBody(), true);
        $blobUrl = $data['url'];

        $meta = [
            'status'     => 'pending',
            'expires_at' => time() + 3600,
            'blob_url'   => $blobUrl,
            'mime'       => $mimeType,
            'ext'        => $ext,
        ];

        $this->http->put(self::BLOB_API . "/meta_{$uuid}.json", [
            'headers' => [
                'Authorization'  => "Bearer {$this->token}",
                'Content-Type'   => 'application/json',
                'x-content-type' => 'application/json',
            ],
            'body' => json_encode($meta),
        ]);

        return $blobUrl;
    }

    public function getMeta(string $uuid): ?array
    {
        try {
            $res = $this->http->get(self::BLOB_API . "/meta_{$uuid}.json", [
                'headers' => ['Authorization' => "Bearer {$this->token}"],
            ]);
            return json_decode((string) $res->getBody(), true);
        } catch (ClientException $e) {
            if ($e->getResponse()->getStatusCode() === 404) return null;
            throw $e;
        }
    }

    public function updateMeta(string $uuid, array $changes): void
    {
        $meta = $this->getMeta($uuid) ?? [];
        $meta = array_merge($meta, $changes);

        $this->http->put(self::BLOB_API . "/meta_{$uuid}.json", [
            'headers' => [
                'Authorization'  => "Bearer {$this->token}",
                'Content-Type'   => 'application/json',
                'x-content-type' => 'application/json',
            ],
            'body' => json_encode($meta),
        ]);
    }

    public function delete(string $uuid): void
    {
        $meta = $this->getMeta($uuid);
        $urls = ["https://blob.vercel-storage.com/meta_{$uuid}.json"];
        if ($meta && isset($meta['blob_url'])) {
            $urls[] = $meta['blob_url'];
        }

        $this->http->delete(self::BLOB_API, [
            'headers' => [
                'Authorization' => "Bearer {$this->token}",
                'Content-Type'  => 'application/json',
            ],
            'json' => ['urls' => $urls],
        ]);
    }

    public function listExpiredUuids(): array
    {
        $res  = $this->http->get(self::BLOB_API, [
            'headers' => ['Authorization' => "Bearer {$this->token}"],
            'query'   => ['prefix' => 'meta_'],
        ]);
        $data  = json_decode((string) $res->getBody(), true);
        $now   = time();
        $uuids = [];

        foreach ($data['blobs'] ?? [] as $blob) {
            preg_match('/meta_([^.]+)\.json$/', $blob['pathname'], $m);
            if (!$m) continue;
            $uuid = $m[1];
            $meta = $this->getMeta($uuid);
            if ($meta && ($meta['expires_at'] ?? 0) < $now) {
                $uuids[] = $uuid;
            }
        }

        return $uuids;
    }
}
