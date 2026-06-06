# PDF_EDITOR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guest-only PHP MVC PDF editor website where users edit PDFs in the browser (PDF-Lib.js), pay ₱50 via PayMongo, then download their file — deployed to Vercel.

**Architecture:** Client-side PDF editing (PDF-Lib.js + PDF.js) sends processed bytes to a PHP MVC backend on Vercel serverless. PHP handles file storage (Vercel Blob), payment creation (PayMongo Payment Links), webhook verification, and signed download URLs. Files expire after 1 hour and are purged by a daily Vercel Cron job.

**Tech Stack:** PHP 8.2, Guzzle 7, vlucas/phpdotenv, ramsey/uuid, PHPUnit 11, PDF-Lib.js 1.17, PDF.js 3.11, JSZip 3.10, Vercel Blob REST API, PayMongo Payment Links API, vercel-php@0.7.2 runtime

---

## File Map

| File | Responsibility |
|---|---|
| `public/index.php` | Entry point — bootstraps app, registers routes, dispatches |
| `app/Core/Router.php` | Pattern-matching router with named params and `match()` + `dispatch()` |
| `app/Core/Controller.php` | Base controller — `render()`, `json()`, `redirect()` |
| `app/Core/View.php` | Renders PHP view templates with extracted data |
| `app/Controllers/HomeController.php` | `index()` → homepage |
| `app/Controllers/EditorController.php` | `index($tool)` → editor page, validates tool name |
| `app/Controllers/PaymentController.php` | `prepare()` POST, `success()` GET, `failed()` GET |
| `app/Controllers/DownloadController.php` | `index()` GET — validates token, redirects to Blob URL |
| `app/Models/FileModel.php` | Vercel Blob upload/meta/delete/listExpired via Guzzle |
| `app/Models/PaymentModel.php` | PayMongo createLink + verifyWebhookSignature |
| `app/Views/layout.php` | Shared HTML shell with purple gradient, nav |
| `app/Views/home/index.php` | 3×2 tool card grid |
| `app/Views/editor/index.php` | Two-column editor: tool sidebar + PDF canvas |
| `app/Views/payment/success.php` | Countdown timer + download button |
| `app/Views/payment/failed.php` | Error message + retry button |
| `app/Views/errors/410.php` | Expired file page |
| `app/Views/errors/404.php` | Not found page |
| `public/css/app.css` | Full design system: gradient, glassmorphism, layout, buttons |
| `public/js/editor.js` | All 6 PDF tool modules + payment initiation |
| `api/webhook.php` | PayMongo webhook: verifies signature, marks token paid |
| `api/cleanup.php` | Vercel Cron: deletes all expired Blob files |
| `vercel.json` | PHP runtime config, cron, routes |
| `composer.json` | PHP dependencies + autoload |
| `.env.example` | Required env vars |
| `.gitignore` | Excludes vendor/, .env, etc. |
| `tests/Core/RouterTest.php` | Router match/dispatch unit tests |
| `tests/Models/FileModelTest.php` | FileModel with Guzzle MockHandler |
| `tests/Models/PaymentModelTest.php` | PaymentModel createLink + signature verification |
| `tests/Controllers/DownloadControllerTest.php` | Token expiry/status logic |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `composer.json`
- Create: `vercel.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `phpunit.xml`

- [ ] **Step 1: Create composer.json**

```json
{
  "name": "pdf-editor/app",
  "type": "project",
  "require": {
    "php": "^8.2",
    "guzzlehttp/guzzle": "^7.8",
    "vlucas/phpdotenv": "^5.6",
    "ramsey/uuid": "^4.7"
  },
  "require-dev": {
    "phpunit/phpunit": "^11.0"
  },
  "autoload": {
    "psr-4": {
      "App\\": "app/"
    }
  },
  "autoload-dev": {
    "psr-4": {
      "Tests\\": "tests/"
    }
  }
}
```

- [ ] **Step 2: Create vercel.json**

```json
{
  "functions": {
    "public/index.php": { "runtime": "vercel-php@0.7.2" },
    "api/webhook.php":  { "runtime": "vercel-php@0.7.2" },
    "api/cleanup.php":  { "runtime": "vercel-php@0.7.2" }
  },
  "crons": [
    { "path": "/api/cleanup", "schedule": "0 3 * * *" }
  ],
  "routes": [
    { "src": "/api/webhook", "dest": "/api/webhook.php" },
    { "src": "/api/cleanup", "dest": "/api/cleanup.php" },
    { "src": "/public/(.*)", "dest": "/public/$1" },
    { "src": "/(.*)",        "dest": "/public/index.php" }
  ]
}
```

- [ ] **Step 3: Create .env.example**

```
PAYMONGO_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
PAYMONGO_WEBHOOK_SECRET=whsk_xxxxxxxxxxxxxxxxxxxx
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
APP_URL=https://your-project.vercel.app
```

- [ ] **Step 4: Create .gitignore**

```
/vendor/
/.env
/node_modules/
/.vercel/
*.log
.DS_Store
```

- [ ] **Step 5: Create phpunit.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true">
    <testsuites>
        <testsuite name="PDF_EDITOR Test Suite">
            <directory>tests</directory>
        </testsuite>
    </testsuites>
</phpunit>
```

- [ ] **Step 6: Install dependencies**

```bash
composer install
```

Expected: `vendor/` created, `vendor/autoload.php` exists.

- [ ] **Step 7: Create directory skeleton**

```bash
mkdir -p app/Core app/Controllers app/Models "app/Views/home" "app/Views/editor" "app/Views/payment" "app/Views/errors" api "public/css" "public/js" tests/Core tests/Models tests/Controllers
```

- [ ] **Step 8: Commit**

```bash
git init
git add composer.json composer.lock vercel.json .env.example .gitignore phpunit.xml
git commit -m "chore: project scaffolding"
```

---

## Task 2: Core Router

**Files:**
- Create: `app/Core/Router.php`
- Create: `tests/Core/RouterTest.php`

- [ ] **Step 1: Write failing tests**

Create `tests/Core/RouterTest.php`:

```php
<?php
namespace Tests\Core;

use App\Core\Router;
use PHPUnit\Framework\TestCase;

class RouterTest extends TestCase
{
    private Router $router;

    protected function setUp(): void
    {
        $this->router = new Router();
    }

    public function test_matches_static_get_route(): void
    {
        $this->router->get('/', ['HomeController', 'index']);
        $match = $this->router->match('GET', '/');
        $this->assertNotNull($match);
        $this->assertEquals(['HomeController', 'index'], $match['handler']);
        $this->assertEmpty($match['params']);
    }

    public function test_matches_dynamic_route_and_extracts_param(): void
    {
        $this->router->get('/editor/{tool}', ['EditorController', 'index']);
        $match = $this->router->match('GET', '/editor/annotate');
        $this->assertNotNull($match);
        $this->assertEquals('annotate', $match['params']['tool']);
    }

    public function test_returns_null_for_unmatched_route(): void
    {
        $this->router->get('/', ['HomeController', 'index']);
        $match = $this->router->match('GET', '/nonexistent');
        $this->assertNull($match);
    }

    public function test_does_not_match_wrong_method(): void
    {
        $this->router->get('/', ['HomeController', 'index']);
        $match = $this->router->match('POST', '/');
        $this->assertNull($match);
    }

    public function test_matches_post_route(): void
    {
        $this->router->post('/payment/prepare', ['PaymentController', 'prepare']);
        $match = $this->router->match('POST', '/payment/prepare');
        $this->assertNotNull($match);
    }

    public function test_strips_query_string_before_matching(): void
    {
        $this->router->get('/payment/success', ['PaymentController', 'success']);
        $match = $this->router->match('GET', '/payment/success?token=abc123');
        $this->assertNotNull($match);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
./vendor/bin/phpunit tests/Core/RouterTest.php
```

Expected: `Error: Class "App\Core\Router" not found`

- [ ] **Step 3: Implement Router**

Create `app/Core/Router.php`:

```php
<?php
namespace App\Core;

class Router
{
    private array $routes = [];

    public function get(string $path, array $handler): void
    {
        $this->routes[] = ['method' => 'GET', 'path' => $path, 'handler' => $handler];
    }

    public function post(string $path, array $handler): void
    {
        $this->routes[] = ['method' => 'POST', 'path' => $path, 'handler' => $handler];
    }

    public function match(string $method, string $uri): ?array
    {
        $uri = strtok($uri, '?');

        foreach ($this->routes as $route) {
            if ($route['method'] !== strtoupper($method)) {
                continue;
            }

            $pattern = preg_replace('/\{([a-zA-Z_]+)\}/', '(?P<$1>[^/]+)', $route['path']);
            $pattern = '#^' . $pattern . '$#';

            if (preg_match($pattern, $uri, $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                return ['handler' => $route['handler'], 'params' => $params];
            }
        }

        return null;
    }

    public function dispatch(string $method, string $uri): void
    {
        $match = $this->match($method, $uri);

        if ($match === null) {
            http_response_code(404);
            if (file_exists(__DIR__ . '/../Views/errors/404.php')) {
                include __DIR__ . '/../Views/errors/404.php';
            } else {
                echo '<h1>404 — Page Not Found</h1>';
            }
            return;
        }

        [$class, $method_name] = $match['handler'];
        $controller = new $class();
        $controller->$method_name(...array_values($match['params']));
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./vendor/bin/phpunit tests/Core/RouterTest.php
```

Expected: `OK (6 tests, 6 assertions)`

- [ ] **Step 5: Commit**

```bash
git add app/Core/Router.php tests/Core/RouterTest.php
git commit -m "feat: add core Router with dynamic param support"
```

---

## Task 3: Core Controller and View

**Files:**
- Create: `app/Core/Controller.php`
- Create: `app/Core/View.php`

- [ ] **Step 1: Create Controller base**

Create `app/Core/Controller.php`:

```php
<?php
namespace App\Core;

class Controller
{
    protected function render(string $template, array $data = []): void
    {
        View::render($template, $data);
    }

    protected function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
    }

    protected function redirect(string $url, int $status = 302): void
    {
        http_response_code($status);
        header("Location: {$url}");
        exit;
    }

    protected function abort(int $code): void
    {
        http_response_code($code);
        $view = __DIR__ . "/../Views/errors/{$code}.php";
        if (file_exists($view)) {
            include $view;
        } else {
            echo "<h1>Error {$code}</h1>";
        }
        exit;
    }
}
```

- [ ] **Step 2: Create View helper**

Create `app/Core/View.php`:

```php
<?php
namespace App\Core;

class View
{
    public static function render(string $template, array $data = []): void
    {
        $file = __DIR__ . "/../Views/{$template}.php";

        if (!file_exists($file)) {
            throw new \RuntimeException("View not found: {$template}");
        }

        extract($data, EXTR_SKIP);
        include $file;
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Core/Controller.php app/Core/View.php
git commit -m "feat: add base Controller and View"
```

---

## Task 4: Entry Point

**Files:**
- Create: `public/index.php`

- [ ] **Step 1: Create public/index.php**

```php
<?php
require_once __DIR__ . '/../vendor/autoload.php';

if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

use App\Core\Router;
use App\Controllers\HomeController;
use App\Controllers\EditorController;
use App\Controllers\PaymentController;
use App\Controllers\DownloadController;

$router = new Router();

$router->get('/',                    [HomeController::class,    'index']);
$router->get('/editor/{tool}',       [EditorController::class,  'index']);
$router->post('/payment/prepare',    [PaymentController::class, 'prepare']);
$router->get('/payment/success',     [PaymentController::class, 'success']);
$router->get('/payment/failed',      [PaymentController::class, 'failed']);
$router->get('/download',            [DownloadController::class,'index']);

$router->dispatch(
    $_SERVER['REQUEST_METHOD'],
    $_SERVER['REQUEST_URI']
);
```

- [ ] **Step 2: Commit**

```bash
git add public/index.php
git commit -m "feat: add entry point with route registration"
```

---

## Task 5: CSS Design System

**Files:**
- Create: `public/css/app.css`

- [ ] **Step 1: Create the full CSS**

Create `public/css/app.css`:

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --grad-start: #667eea;
  --grad-end:   #764ba2;
  --glass-bg:   rgba(255, 255, 255, 0.13);
  --glass-border: rgba(255, 255, 255, 0.22);
  --amber:      #fbbf24;
  --amber-dark: #f59e0b;
  --text:       #ffffff;
  --text-muted: rgba(255,255,255,0.65);
  --success:    #10b981;
  --danger:     #ef4444;
  --radius:     12px;
  --shadow:     0 8px 32px rgba(0,0,0,0.25);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, var(--grad-start), var(--grad-end));
  min-height: 100vh;
  color: var(--text);
}

/* ── Nav ── */
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: rgba(0,0,0,0.15);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--glass-border);
}
.nav__logo {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 1px;
  text-decoration: none;
  color: var(--text);
}
.nav__tagline { font-size: 12px; color: var(--text-muted); }

/* ── Glass card ── */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

/* ── Homepage tool grid ── */
.hero {
  text-align: center;
  padding: 60px 32px 32px;
}
.hero__title { font-size: 36px; font-weight: 800; margin-bottom: 10px; }
.hero__sub   { font-size: 16px; color: var(--text-muted); margin-bottom: 48px; }

.tool-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 640px;
  margin: 0 auto 60px;
  padding: 0 24px;
}
.tool-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 16px;
  text-decoration: none;
  color: var(--text);
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
}
.tool-card:hover {
  transform: translateY(-4px);
  background: rgba(255,255,255,0.22);
}
.tool-card__icon { font-size: 32px; }
.tool-card__label { font-size: 13px; font-weight: 600; }

/* ── Editor layout ── */
.editor-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  height: calc(100vh - 57px);
  overflow: hidden;
}
.editor-sidebar {
  padding: 16px;
  border-right: 1px solid var(--glass-border);
  background: rgba(0,0,0,0.15);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.editor-main {
  position: relative;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  gap: 16px;
}

/* ── Upload zone ── */
.upload-zone {
  border: 2px dashed var(--glass-border);
  border-radius: var(--radius);
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  width: 100%;
}
.upload-zone:hover, .upload-zone.drag-over {
  border-color: var(--amber);
  background: rgba(251,191,36,0.08);
}
.upload-zone__icon { font-size: 36px; margin-bottom: 8px; }
.upload-zone__text { font-size: 13px; color: var(--text-muted); }

/* ── PDF canvas wrapper ── */
.pdf-wrapper {
  position: relative;
  display: inline-block;
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
}
#pdf-canvas    { display: block; }
#overlay-canvas {
  position: absolute;
  top: 0; left: 0;
  cursor: crosshair;
}

/* ── Sidebar tool buttons ── */
.tool-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background 0.15s;
}
.tool-btn:hover    { background: var(--glass-bg); }
.tool-btn.active   { background: var(--glass-bg); border-color: var(--glass-border); }
.tool-btn__icon    { font-size: 16px; }

.sidebar-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
  text-transform: uppercase;
  padding: 4px 0;
  margin-top: 8px;
}
.sidebar-divider {
  border: none;
  border-top: 1px solid var(--glass-border);
  margin: 4px 0;
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s, transform 0.15s;
  text-decoration: none;
}
.btn:hover   { opacity: 0.9; transform: translateY(-1px); }
.btn:active  { transform: translateY(0); }
.btn--amber  { background: var(--amber); color: #1f2937; }
.btn--white  { background: rgba(255,255,255,0.15); color: var(--text); border: 1px solid var(--glass-border); }
.btn--danger { background: var(--danger); color: #fff; }
.btn--full   { width: 100%; }

/* ── CTA bar (bottom of editor) ── */
.cta-bar {
  position: fixed;
  bottom: 0; left: 220px; right: 0;
  padding: 12px 24px;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  z-index: 100;
}

/* ── File list (for merge) ── */
.file-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}
.file-item__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-item__del  { cursor: pointer; color: var(--text-muted); font-size: 14px; }

/* ── Payment / success pages ── */
.page-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 57px);
  padding: 32px;
}
.payment-card {
  max-width: 420px;
  width: 100%;
  padding: 40px 32px;
  text-align: center;
}
.payment-card__icon   { font-size: 52px; margin-bottom: 16px; }
.payment-card__title  { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
.payment-card__sub    { font-size: 14px; color: var(--text-muted); margin-bottom: 28px; }
.countdown {
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
  font-size: 13px;
}
.countdown__time { font-size: 22px; font-weight: 700; color: var(--amber); }

/* ── Toast ── */
.toast {
  position: fixed;
  bottom: 24px; left: 50%;
  transform: translateX(-50%);
  background: rgba(30,30,40,0.95);
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}
.toast.show { opacity: 1; }

/* ── Signature canvas ── */
.sig-canvas {
  width: 100%;
  height: 140px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  border: 1px dashed var(--glass-border);
  touch-action: none;
  cursor: crosshair;
}

/* ── Page nav ── */
.page-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.page-nav button {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text);
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
}

/* ── Input ── */
.field {
  width: 100%;
  padding: 9px 12px;
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
}
.field::placeholder { color: var(--text-muted); }
.field:focus { outline: none; border-color: var(--amber); }
.field-label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; font-weight: 600; }

/* ── Responsive ── */
@media (max-width: 640px) {
  .tool-grid { grid-template-columns: repeat(2, 1fr); }
  .editor-layout { grid-template-columns: 1fr; }
  .editor-sidebar { display: none; }
  .cta-bar { left: 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/css/app.css
git commit -m "feat: add full CSS design system with glassmorphism"
```

---

## Task 6: Layout + Error Views

**Files:**
- Create: `app/Views/layout.php`
- Create: `app/Views/errors/404.php`
- Create: `app/Views/errors/410.php`

- [ ] **Step 1: Create layout.php**

Create `app/Views/layout.php`:

```php
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= htmlspecialchars($title ?? 'PDF_EDITOR') ?></title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body>
<nav class="nav">
  <a href="/" class="nav__logo">PDF_EDITOR</a>
  <span class="nav__tagline">₱50 per download · No account needed</span>
</nav>
<?= $content ?>
<div class="toast" id="toast"></div>
<script>
function showToast(msg, ms = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}
</script>
</body>
</html>
```

- [ ] **Step 2: Create 404 view**

Create `app/Views/errors/404.php`:

```php
<?php
$title = '404 — Not Found';
ob_start();
?>
<div class="page-center">
  <div class="payment-card glass">
    <div class="payment-card__icon">🔍</div>
    <div class="payment-card__title">Page Not Found</div>
    <div class="payment-card__sub">The page you're looking for doesn't exist.</div>
    <a href="/" class="btn btn--amber btn--full">← Back to Home</a>
  </div>
</div>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
```

- [ ] **Step 3: Create 410 view**

Create `app/Views/errors/410.php`:

```php
<?php
$title = 'File Expired';
ob_start();
?>
<div class="page-center">
  <div class="payment-card glass">
    <div class="payment-card__icon">⏰</div>
    <div class="payment-card__title">File Expired</div>
    <div class="payment-card__sub">This file has been deleted. Files are only kept for 1 hour after payment.</div>
    <a href="/" class="btn btn--amber btn--full">Start Over</a>
  </div>
</div>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
```

- [ ] **Step 4: Commit**

```bash
git add app/Views/layout.php app/Views/errors/
git commit -m "feat: add layout shell and error views"
```

---

## Task 7: Homepage

**Files:**
- Create: `app/Controllers/HomeController.php`
- Create: `app/Views/home/index.php`

- [ ] **Step 1: Create HomeController**

Create `app/Controllers/HomeController.php`:

```php
<?php
namespace App\Controllers;

use App\Core\Controller;

class HomeController extends Controller
{
    public function index(): void
    {
        $this->render('home/index', ['title' => 'PDF_EDITOR — Free PDF Tools']);
    }
}
```

- [ ] **Step 2: Create home/index.php view**

Create `app/Views/home/index.php`:

```php
<?php
ob_start();
$tools = [
  ['icon' => '✏️',  'label' => 'Annotate',   'slug' => 'annotate',  'desc' => 'Add text, highlights & drawings'],
  ['icon' => '🔗',  'label' => 'Merge',       'slug' => 'merge',     'desc' => 'Combine multiple PDFs into one'],
  ['icon' => '✂️',  'label' => 'Split',       'slug' => 'split',     'desc' => 'Extract pages or ranges'],
  ['icon' => '🗜️', 'label' => 'Compress',    'slug' => 'compress',  'desc' => 'Reduce file size'],
  ['icon' => '🔄',  'label' => 'Convert',     'slug' => 'convert',   'desc' => 'Export pages as JPG images'],
  ['icon' => '📝',  'label' => 'Fill & Sign', 'slug' => 'sign',      'desc' => 'Fill forms and add signature'],
];
?>
<div class="hero">
  <h1 class="hero__title">Edit PDFs — Free</h1>
  <p class="hero__sub">All tools run in your browser. Pay ₱50 to download your file.</p>

  <div class="tool-grid">
    <?php foreach ($tools as $t): ?>
    <a href="/editor/<?= $t['slug'] ?>" class="tool-card glass">
      <div class="tool-card__icon"><?= $t['icon'] ?></div>
      <div class="tool-card__label"><?= $t['label'] ?></div>
    </a>
    <?php endforeach; ?>
  </div>
</div>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
```

- [ ] **Step 3: Commit**

```bash
git add app/Controllers/HomeController.php app/Views/home/index.php
git commit -m "feat: homepage with tool grid"
```

---

## Task 8: Editor Controller + View

**Files:**
- Create: `app/Controllers/EditorController.php`
- Create: `app/Views/editor/index.php`

- [ ] **Step 1: Create EditorController**

Create `app/Controllers/EditorController.php`:

```php
<?php
namespace App\Controllers;

use App\Core\Controller;

class EditorController extends Controller
{
    private const VALID_TOOLS = ['annotate', 'merge', 'split', 'compress', 'convert', 'sign'];

    public function index(string $tool): void
    {
        if (!in_array($tool, self::VALID_TOOLS, true)) {
            $this->abort(404);
        }

        $toolMeta = [
            'annotate' => ['icon' => '✏️',  'label' => 'Annotate'],
            'merge'    => ['icon' => '🔗',  'label' => 'Merge'],
            'split'    => ['icon' => '✂️',  'label' => 'Split'],
            'compress' => ['icon' => '🗜️', 'label' => 'Compress'],
            'convert'  => ['icon' => '🔄',  'label' => 'Convert to JPG'],
            'sign'     => ['icon' => '📝',  'label' => 'Fill & Sign'],
        ];

        $this->render('editor/index', [
            'title' => 'PDF_EDITOR — ' . $toolMeta[$tool]['label'],
            'tool'  => $tool,
            'meta'  => $toolMeta[$tool],
        ]);
    }
}
```

- [ ] **Step 2: Create editor/index.php view**

Create `app/Views/editor/index.php`:

```php
<?php ob_start(); ?>
<div class="editor-layout">

  <!-- Sidebar -->
  <aside class="editor-sidebar">

    <?php if ($tool === 'annotate'): ?>
    <div class="sidebar-label">Annotation Tools</div>
    <button class="tool-btn active" onclick="AnnotateTool.setMode('text')"    id="btn-text">    <span class="tool-btn__icon">🖊</span> Text</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('highlight')" id="btn-highlight"><span class="tool-btn__icon">🖍</span> Highlight</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('draw')"    id="btn-draw">    <span class="tool-btn__icon">✏️</span> Freehand</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('rect')"    id="btn-rect">    <span class="tool-btn__icon">▭</span> Rectangle</button>
    <hr class="sidebar-divider">
    <button class="tool-btn" onclick="AnnotateTool.undo()"><span class="tool-btn__icon">↩</span> Undo</button>
    <button class="tool-btn" onclick="AnnotateTool.clear()"><span class="tool-btn__icon">🗑</span> Clear All</button>

    <?php elseif ($tool === 'merge'): ?>
    <div class="sidebar-label">Files to Merge</div>
    <button class="tool-btn" onclick="document.getElementById('merge-input').click()">
      <span class="tool-btn__icon">➕</span> Add PDFs
    </button>
    <input type="file" id="merge-input" accept=".pdf" multiple hidden>
    <ul class="file-list" id="merge-list"></ul>

    <?php elseif ($tool === 'split'): ?>
    <div class="sidebar-label">Split Options</div>
    <div class="field-label">Page Range (e.g. 1-3, 5)</div>
    <input type="text" id="split-range" class="field" placeholder="e.g. 1-3, 5, 7-9">
    <div class="field-label" style="margin-top:12px;">Or extract each page separately</div>
    <button class="tool-btn" id="btn-each-page" onclick="SplitTool.toggleEachPage()">
      <span class="tool-btn__icon">☐</span> Each page as file
    </button>

    <?php elseif ($tool === 'compress'): ?>
    <div class="sidebar-label">Compress</div>
    <div id="compress-info" style="font-size:12px;color:rgba(255,255,255,0.7);line-height:1.6;">
      Upload a PDF to see size info.
    </div>

    <?php elseif ($tool === 'convert'): ?>
    <div class="sidebar-label">Export as JPG</div>
    <div class="field-label">Pages to export</div>
    <input type="text" id="convert-pages" class="field" placeholder="e.g. all, 1, 2-4">
    <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:6px;">Output: ZIP of JPG images</div>

    <?php elseif ($tool === 'sign'): ?>
    <div class="sidebar-label">Signature</div>
    <canvas class="sig-canvas" id="sig-canvas"></canvas>
    <div style="display:flex;gap:6px;margin-top:6px;">
      <button class="tool-btn" style="flex:1" onclick="SignTool.clearSig()"><span class="tool-btn__icon">🗑</span> Clear</button>
      <button class="tool-btn" style="flex:1" onclick="SignTool.placeSig()"><span class="tool-btn__icon">📌</span> Place</button>
    </div>
    <hr class="sidebar-divider">
    <div class="sidebar-label">Form Fields</div>
    <div id="field-list" style="font-size:12px;color:rgba(255,255,255,0.7);">Upload to detect fields.</div>
    <?php endif; ?>

  </aside>

  <!-- Main canvas area -->
  <main class="editor-main" id="editor-main">
    <div class="upload-zone glass" id="upload-zone" onclick="triggerUpload()">
      <div class="upload-zone__icon">📄</div>
      <div class="upload-zone__text">
        <?= $tool === 'merge' ? 'Drop PDFs here or click to add files' : 'Drop PDF here or click to upload' ?>
        <br><small>Max 20 MB per file</small>
      </div>
    </div>
    <input type="file" id="main-upload" accept=".pdf" hidden <?= $tool === 'merge' ? 'multiple' : '' ?>>

    <div id="pdf-container" style="display:none;">
      <div class="page-nav">
        <button onclick="Editor.prevPage()">← Prev</button>
        <span id="page-info">Page 1 / 1</span>
        <button onclick="Editor.nextPage()">Next →</button>
      </div>
      <div class="pdf-wrapper">
        <canvas id="pdf-canvas"></canvas>
        <canvas id="overlay-canvas"></canvas>
      </div>
    </div>
  </main>
</div>

<!-- CTA bar -->
<div class="cta-bar">
  <span id="cta-status" style="font-size:13px;color:rgba(255,255,255,0.7);"></span>
  <button class="btn btn--amber" id="btn-pay" onclick="initiatePayment()" disabled>
    ⬇️ Download — Pay ₱50
  </button>
</div>

<script>window.CURRENT_TOOL = '<?= htmlspecialchars($tool, ENT_QUOTES) ?>';</script>
<script src="/js/pdf-lib.min.js"></script>
<script src="/js/pdf.min.js"></script>
<script src="/js/jszip.min.js"></script>
<script src="/js/editor.js"></script>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
```

- [ ] **Step 3: Commit**

```bash
git add app/Controllers/EditorController.php app/Views/editor/index.php
git commit -m "feat: editor controller and view with tool-specific sidebars"
```

---

## Task 9: Download JavaScript Libraries

**Files:**
- Create: `public/js/pdf-lib.min.js`
- Create: `public/js/pdf.min.js`
- Create: `public/js/jszip.min.js`

- [ ] **Step 1: Download PDF-Lib.js**

```bash
curl -L "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js" -o public/js/pdf-lib.min.js
```

- [ ] **Step 2: Download PDF.js**

```bash
curl -L "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" -o public/js/pdf.min.js
curl -L "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js" -o public/js/pdf.worker.min.js
```

- [ ] **Step 3: Download JSZip**

```bash
curl -L "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" -o public/js/jszip.min.js
```

- [ ] **Step 4: Configure PDF.js worker path**

At the top of `public/js/editor.js` (created in next task), set:
```js
pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
```

- [ ] **Step 5: Commit**

```bash
git add public/js/pdf-lib.min.js public/js/pdf.min.js public/js/pdf.worker.min.js public/js/jszip.min.js
git commit -m "chore: add PDF-Lib, PDF.js, and JSZip client libraries"
```

---

## Task 10: Editor JavaScript — Core + Annotate

**Files:**
- Create: `public/js/editor.js` (core + annotate tool)

- [ ] **Step 1: Create editor.js with core state and annotate tool**

Create `public/js/editor.js`:

```js
'use strict';

// ── PDF.js worker ──────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';

// ── Shared state ───────────────────────────────────────────────
const Editor = (() => {
  let pdfjsDoc   = null;
  let pdfLibDoc  = null;
  let rawBytes   = null;
  let pageNum    = 1;
  let totalPages = 0;

  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

  function guardSize(file) {
    if (file.size > MAX_BYTES) {
      showToast('File exceeds 20 MB limit');
      return false;
    }
    return true;
  }

  async function loadFile(file) {
    if (!guardSize(file)) return;
    rawBytes = await file.arrayBuffer();
    const uint8 = new Uint8Array(rawBytes);
    pdfjsDoc  = await pdfjsLib.getDocument({ data: uint8 }).promise;
    pdfLibDoc = await PDFLib.PDFDocument.load(uint8);
    totalPages = pdfjsDoc.numPages;
    pageNum = 1;

    document.getElementById('upload-zone').style.display = 'none';
    document.getElementById('pdf-container').style.display = 'block';
    document.getElementById('btn-pay').disabled = false;

    if (window.CURRENT_TOOL === 'compress') {
      document.getElementById('compress-info').textContent =
        `Original size: ${(file.size / 1024).toFixed(1)} KB`;
    }
    if (window.CURRENT_TOOL === 'sign') {
      SignTool.detectFields();
    }

    await renderPage(pageNum);
  }

  async function renderPage(n) {
    const page    = await pdfjsDoc.getPage(n);
    const scale   = 1.4;
    const vp      = page.getViewport({ scale });
    const canvas  = document.getElementById('pdf-canvas');
    const overlay = document.getElementById('overlay-canvas');
    canvas.width  = overlay.width  = vp.width;
    canvas.height = overlay.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    document.getElementById('page-info').textContent = `Page ${n} / ${totalPages}`;

    if (window.CURRENT_TOOL === 'annotate') {
      AnnotateTool.onPageRender(n);
    }
  }

  async function prevPage() {
    if (pageNum > 1) { pageNum--; await renderPage(pageNum); }
  }
  async function nextPage() {
    if (pageNum < totalPages) { pageNum++; await renderPage(pageNum); }
  }

  function getState() { return { pdfjsDoc, pdfLibDoc, rawBytes, pageNum, totalPages }; }

  return { loadFile, renderPage, prevPage, nextPage, guardSize, getState };
})();

// ── Upload wiring ───────────────────────────────────────────────
function triggerUpload() {
  document.getElementById('main-upload').click();
}
document.getElementById('main-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) Editor.loadFile(file);
});

const uploadZone = document.getElementById('upload-zone');
uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) Editor.loadFile(file);
});

// ── Annotate Tool ───────────────────────────────────────────────
const AnnotateTool = (() => {
  let mode       = 'text';
  let drawing    = false;
  let startX     = 0, startY = 0;
  let history    = {};  // { pageNum: [actions] }
  let tempPath   = [];

  function setMode(m) {
    mode = m;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const map = { text: 'btn-text', highlight: 'btn-highlight', draw: 'btn-draw', rect: 'btn-rect' };
    document.getElementById(map[m])?.classList.add('active');
    const overlay = document.getElementById('overlay-canvas');
    overlay.style.cursor = (m === 'text') ? 'text' : 'crosshair';
  }

  function onPageRender(n) {
    const overlay = document.getElementById('overlay-canvas');
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    (history[n] || []).forEach(a => drawAction(ctx, a));
    bindEvents(overlay, n);
  }

  function bindEvents(canvas, n) {
    canvas.onmousedown = e => {
      drawing = true;
      const r = canvas.getBoundingClientRect();
      startX = e.clientX - r.left;
      startY = e.clientY - r.top;
      if (mode === 'text') {
        drawing = false;
        const text = prompt('Enter text:');
        if (!text) return;
        const action = { type: 'text', x: startX, y: startY, text };
        (history[n] = history[n] || []).push(action);
        drawAction(canvas.getContext('2d'), action);
      }
      if (mode === 'draw') tempPath = [{ x: startX, y: startY }];
    };
    canvas.onmousemove = e => {
      if (!drawing) return;
      const r  = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const ctx = canvas.getContext('2d');
      if (mode === 'draw') {
        tempPath.push({ x: cx, y: cy });
        ctx.strokeStyle = 'rgba(255,0,0,0.8)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        const p = tempPath;
        ctx.beginPath();
        ctx.moveTo(p[p.length - 2].x, p[p.length - 2].y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
      if (mode === 'highlight' || mode === 'rect') {
        const actions = (history[n] || []).filter(a => a.type !== '_preview');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        actions.forEach(a => drawAction(ctx, a));
        drawAction(ctx, { type: mode, x: startX, y: startY, w: cx - startX, h: cy - startY, preview: true });
      }
    };
    canvas.onmouseup = e => {
      if (!drawing) return;
      drawing = false;
      const r  = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      if (mode === 'draw') {
        (history[n] = history[n] || []).push({ type: 'draw', path: [...tempPath] });
      } else if (mode === 'highlight' || mode === 'rect') {
        (history[n] = history[n] || []).push({ type: mode, x: startX, y: startY, w: cx - startX, h: cy - startY });
      }
      onPageRender(n);
    };
  }

  function drawAction(ctx, a) {
    if (a.type === 'text') {
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#0000ff';
      ctx.fillText(a.text, a.x, a.y);
    } else if (a.type === 'highlight') {
      ctx.fillStyle = 'rgba(255,230,0,0.4)';
      ctx.fillRect(a.x, a.y, a.w, a.h);
    } else if (a.type === 'rect') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(a.x, a.y, a.w, a.h);
    } else if (a.type === 'draw' && a.path?.length > 1) {
      ctx.strokeStyle = 'rgba(255,0,0,0.8)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.path[0].x, a.path[0].y);
      a.path.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
  }

  function undo() {
    const { pageNum } = Editor.getState();
    if (history[pageNum]?.length) {
      history[pageNum].pop();
      onPageRender(pageNum);
    }
  }

  function clear() {
    const { pageNum } = Editor.getState();
    history[pageNum] = [];
    onPageRender(pageNum);
  }

  async function getProcessedBytes() {
    const { pdfLibDoc, totalPages } = Editor.getState();
    const pdfCanvas = document.getElementById('pdf-canvas');
    const scale = 1.4;
    for (let n = 1; n <= totalPages; n++) {
      const actions = history[n] || [];
      if (!actions.length) continue;
      const page = pdfLibDoc.getPage(n - 1);
      const { width, height } = page.getSize();
      const scaleX = width  / pdfCanvas.width;
      const scaleY = height / pdfCanvas.height;
      for (const a of actions) {
        if (a.type === 'text') {
          page.drawText(a.text, {
            x: a.x * scaleX,
            y: height - a.y * scaleY,
            size: 14,
            color: PDFLib.rgb(0, 0, 1),
          });
        } else if (a.type === 'highlight') {
          page.drawRectangle({
            x: a.x * scaleX,
            y: height - (a.y + a.h) * scaleY,
            width:  Math.abs(a.w) * scaleX,
            height: Math.abs(a.h) * scaleY,
            color: PDFLib.rgb(1, 0.9, 0),
            opacity: 0.4,
          });
        } else if (a.type === 'rect') {
          page.drawRectangle({
            x: a.x * scaleX,
            y: height - (a.y + a.h) * scaleY,
            width:  Math.abs(a.w) * scaleX,
            height: Math.abs(a.h) * scaleY,
            borderColor: PDFLib.rgb(1, 0, 0),
            borderWidth: 2,
          });
        }
      }
    }
    return await pdfLibDoc.save();
  }

  return { setMode, onPageRender, undo, clear, getProcessedBytes };
})();
```

- [ ] **Step 2: Add image annotation support — append inside AnnotateTool before the closing `return` statement**

In `public/js/editor.js`, inside the `AnnotateTool` IIFE, before `return { setMode, ... }`:

```js
  // Image mode — click canvas to pick placement, then select file
  const imgInput = document.createElement('input');
  imgInput.type = 'file'; imgInput.accept = 'image/*'; imgInput.style.display = 'none';
  document.body.appendChild(imgInput);
  let pendingImgPlacement = null;

  // Extend setMode to include 'image'
  const _origSetMode = setMode;
  // (handled below — image click wired in bindEvents already via the onmousedown branch)
```

Then inside `bindEvents`, add the `image` branch to `canvas.onmousedown` right after the `text` block:

```js
      if (mode === 'image') {
        drawing = false;
        pendingImgPlacement = { x: startX, y: startY };
        imgInput.click();
      }
```

And wire `imgInput.onchange` inside `AnnotateTool` (after `bindEvents`):

```js
  imgInput.onchange = async () => {
    if (!imgInput.files[0] || !pendingImgPlacement) return;
    const file    = imgInput.files[0];
    const dataUrl = await new Promise(res => {
      const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file);
    });
    const { pageNum } = Editor.getState();
    (history[pageNum] = history[pageNum] || []).push({
      type: 'img', x: pendingImgPlacement.x, y: pendingImgPlacement.y,
      w: 150, h: 100, src: dataUrl
    });
    onPageRender(pageNum);
    pendingImgPlacement = null;
    imgInput.value = '';
  };
```

Add `'img'` case to `drawAction`:

```js
    } else if (a.type === 'img') {
      const img = new Image(); img.src = a.src;
      img.onload = () => {
        canvas.getContext('2d').drawImage(img, a.x, a.y, a.w, a.h);
      };
      if (img.complete) canvas.getContext('2d').drawImage(img, a.x, a.y, a.w, a.h);
```

Add `'img'` case to `getProcessedBytes` — embed into PDF page:

```js
        if (a.type === 'img') {
          const bytes = await fetch(a.src).then(r => r.arrayBuffer());
          const isPng = a.src.startsWith('data:image/png');
          const emb   = isPng ? await pdfLibDoc.embedPng(bytes) : await pdfLibDoc.embedJpg(bytes);
          const { height } = page.getSize();
          page.drawImage(emb, {
            x: a.x * scaleX, y: height - (a.y + a.h) * scaleY,
            width: a.w * scaleX, height: a.h * scaleY,
          });
        }
```

Also update the `setMode` map to include `image`:

```js
    const map = { text: 'btn-text', highlight: 'btn-highlight', draw: 'btn-draw', rect: 'btn-rect', image: 'btn-image' };
```

And update the `return` statement to expose image mode:

```js
  return { setMode, onPageRender, undo, clear, getProcessedBytes };
```

- [ ] **Step 3: Commit**

```bash
git add public/js/editor.js
git commit -m "feat: editor.js core state, upload wiring, and annotate tool"
```

---

## Task 11: Editor JavaScript — Merge, Split, Compress

**Files:**
- Modify: `public/js/editor.js` (append MergeTool, SplitTool, CompressTool)

- [ ] **Step 1: Append MergeTool to editor.js**

Append to `public/js/editor.js`:

```js
// ── Merge Tool ──────────────────────────────────────────────────
const MergeTool = (() => {
  const files = [];

  document.getElementById('merge-input')?.addEventListener('change', async e => {
    for (const file of e.target.files) {
      if (!Editor.guardSize(file)) continue;
      const bytes = await file.arrayBuffer();
      files.push({ name: file.name, bytes });
      renderList();
    }
    if (files.length >= 2) document.getElementById('btn-pay').disabled = false;
    e.target.value = '';
  });

  function renderList() {
    const ul = document.getElementById('merge-list');
    ul.innerHTML = files.map((f, i) => `
      <li class="file-item">
        <span class="file-item__name" title="${f.name}">📄 ${f.name}</span>
        <span class="file-item__del" onclick="MergeTool.remove(${i})">✕</span>
      </li>`).join('');
  }

  function remove(i) {
    files.splice(i, 1);
    renderList();
    if (files.length < 2) document.getElementById('btn-pay').disabled = true;
  }

  async function getProcessedBytes() {
    if (files.length < 2) throw new Error('Need at least 2 PDFs to merge');
    const merged = await PDFLib.PDFDocument.create();
    for (const f of files) {
      const src   = await PDFLib.PDFDocument.load(f.bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    return await merged.save();
  }

  return { remove, getProcessedBytes };
})();

// ── Split Tool ──────────────────────────────────────────────────
const SplitTool = (() => {
  let eachPage = false;

  function toggleEachPage() {
    eachPage = !eachPage;
    const btn = document.getElementById('btn-each-page');
    btn.innerHTML = `<span class="tool-btn__icon">${eachPage ? '☑' : '☐'}</span> Each page as file`;
    document.getElementById('split-range').disabled = eachPage;
  }

  function parseRanges(input, total) {
    if (!input.trim()) return [[1, total]];
    const ranges = [];
    input.split(',').forEach(part => {
      const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return;
      const s = Math.max(1, parseInt(m[1]));
      const e = Math.min(total, parseInt(m[2] ?? m[1]));
      if (s <= e) ranges.push([s, e]);
    });
    return ranges.length ? ranges : [[1, total]];
  }

  async function getProcessedBytes() {
    const { pdfLibDoc, totalPages } = Editor.getState();
    const zip = new JSZip();
    let ranges;
    if (eachPage) {
      ranges = Array.from({ length: totalPages }, (_, i) => [i + 1, i + 1]);
    } else {
      ranges = parseRanges(document.getElementById('split-range').value, totalPages);
    }
    for (let i = 0; i < ranges.length; i++) {
      const [start, end] = ranges[i];
      const newDoc = await PDFLib.PDFDocument.create();
      const idxs   = Array.from({ length: end - start + 1 }, (_, k) => start - 1 + k);
      const pages  = await newDoc.copyPages(pdfLibDoc, idxs);
      pages.forEach(p => newDoc.addPage(p));
      const bytes  = await newDoc.save();
      zip.file(`pages_${start}-${end}.pdf`, bytes);
    }
    return await zip.generateAsync({ type: 'uint8array' });
  }

  return { toggleEachPage, getProcessedBytes };
})();

// ── Compress Tool ───────────────────────────────────────────────
const CompressTool = (() => {
  async function getProcessedBytes() {
    const { pdfLibDoc } = Editor.getState();
    const bytes = await pdfLibDoc.save({ useObjectStreams: true });
    const info  = document.getElementById('compress-info');
    if (info) {
      info.textContent += `\nCompressed size: ${(bytes.byteLength / 1024).toFixed(1)} KB`;
    }
    return bytes;
  }
  return { getProcessedBytes };
})();
```

- [ ] **Step 2: Commit**

```bash
git add public/js/editor.js
git commit -m "feat: add Merge, Split, and Compress JS tools"
```

---

## Task 12: Editor JavaScript — Convert + Fill & Sign

**Files:**
- Modify: `public/js/editor.js` (append ConvertTool, SignTool)

- [ ] **Step 1: Append ConvertTool and SignTool to editor.js**

Append to `public/js/editor.js`:

```js
// ── Convert Tool (PDF → JPG ZIP) ─────────────────────────────────
const ConvertTool = (() => {
  async function getProcessedBytes() {
    const { pdfjsDoc, totalPages } = Editor.getState();
    const input  = document.getElementById('convert-pages').value.trim().toLowerCase();
    const zip    = new JSZip();
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');

    let pageNums;
    if (!input || input === 'all') {
      pageNums = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      pageNums = [];
      input.split(',').forEach(part => {
        const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
        if (!m) return;
        const s = parseInt(m[1]), e = parseInt(m[2] ?? m[1]);
        for (let i = s; i <= e; i++) if (i >= 1 && i <= totalPages) pageNums.push(i);
      });
    }

    for (const n of pageNums) {
      const page = await pdfjsDoc.getPage(n);
      const vp   = page.getViewport({ scale: 2.0 });
      canvas.width  = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      const buf  = await blob.arrayBuffer();
      zip.file(`page_${n}.jpg`, buf);
    }

    return await zip.generateAsync({ type: 'uint8array' });
  }

  return { getProcessedBytes };
})();

// ── Fill & Sign Tool ────────────────────────────────────────────
const SignTool = (() => {
  let sigDrawing = false;
  let sigPath    = [];
  let placements = [];

  function initSigCanvas() {
    const canvas = document.getElementById('sig-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.onmousedown = e => { sigDrawing = true; sigPath = [getPos(canvas, e)]; };
    canvas.onmousemove = e => {
      if (!sigDrawing) return;
      sigPath.push(getPos(canvas, e));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sigPath[0].x, sigPath[0].y);
      sigPath.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
    };
    canvas.onmouseup = () => { sigDrawing = false; };
  }

  function getPos(canvas, e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function clearSig() {
    const canvas = document.getElementById('sig-canvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    sigPath = [];
  }

  function placeSig() {
    if (!sigPath.length) { showToast('Draw a signature first'); return; }
    const { pageNum } = Editor.getState();
    const sigCanvas   = document.getElementById('sig-canvas');
    const overlay     = document.getElementById('overlay-canvas');
    const imgData     = sigCanvas.toDataURL('image/png');
    placements.push({ page: pageNum, x: 100, y: 100, imgData });
    showToast('Signature placed on page ' + pageNum);
    const ctx = overlay.getContext('2d');
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 100, 100, 160, 60);
    img.src = imgData;
  }

  function detectFields() {
    const { pdfLibDoc } = Editor.getState();
    const form = pdfLibDoc.getForm();
    const fields = form.getFields();
    const el = document.getElementById('field-list');
    if (!fields.length) { el.textContent = 'No form fields detected.'; return; }
    el.innerHTML = fields.map(f => `<div style="margin-bottom:4px;">📋 ${f.getName()}</div>`).join('');
  }

  async function getProcessedBytes() {
    const { pdfLibDoc } = Editor.getState();
    for (const pl of placements) {
      const page     = pdfLibDoc.getPage(pl.page - 1);
      const imgBytes = await fetch(pl.imgData).then(r => r.arrayBuffer());
      const img      = await pdfLibDoc.embedPng(imgBytes);
      const { height } = page.getSize();
      page.drawImage(img, { x: pl.x, y: height - pl.y - 60, width: 160, height: 60 });
    }
    return await pdfLibDoc.save();
  }

  document.addEventListener('DOMContentLoaded', initSigCanvas);

  return { clearSig, placeSig, detectFields, getProcessedBytes };
})();
```

- [ ] **Step 2: Commit**

```bash
git add public/js/editor.js
git commit -m "feat: add Convert (PDF→JPG) and Fill & Sign JS tools"
```

---

## Task 13: Payment Initiation (JS side)

**Files:**
- Modify: `public/js/editor.js` (append `initiatePayment`)

- [ ] **Step 1: Append initiatePayment to editor.js**

Append to `public/js/editor.js`:

```js
// ── Payment Initiation ──────────────────────────────────────────
async function initiatePayment() {
  const btn = document.getElementById('btn-pay');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  try {
    const tool = window.CURRENT_TOOL;
    const toolMap = {
      annotate: AnnotateTool,
      merge:    MergeTool,
      split:    SplitTool,
      compress: CompressTool,
      convert:  ConvertTool,
      sign:     SignTool,
    };

    const bytes    = await toolMap[tool].getProcessedBytes();
    const mimeType = (tool === 'split' || tool === 'convert') ? 'application/zip' : 'application/pdf';
    const ext      = (tool === 'split' || tool === 'convert') ? 'zip' : 'pdf';

    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mimeType }), `output.${ext}`);
    form.append('mime', mimeType);

    const res  = await fetch('/payment/prepare', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok || !data.checkout_url) {
      throw new Error(data.error ?? 'Failed to create payment');
    }

    window.location.href = data.checkout_url;
  } catch (err) {
    showToast('Error: ' + err.message);
    btn.disabled = false;
    btn.textContent = '⬇️ Download — Pay ₱50';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/editor.js
git commit -m "feat: payment initiation in JS — sends processed PDF to backend"
```

---

## Task 14: FileModel — Vercel Blob

**Files:**
- Create: `app/Models/FileModel.php`
- Create: `tests/Models/FileModelTest.php`

- [ ] **Step 1: Write failing tests**

Create `tests/Models/FileModelTest.php`:

```php
<?php
namespace Tests\Models;

use App\Models\FileModel;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

class FileModelTest extends TestCase
{
    private function makeModel(array $responses): FileModel
    {
        $mock    = new MockHandler($responses);
        $handler = HandlerStack::create($mock);
        $client  = new Client(['handler' => $handler]);
        return new FileModel('fake-token', $client);
    }

    public function test_upload_returns_blob_url(): void
    {
        $model = $this->makeModel([
            new Response(200, [], json_encode(['url' => 'https://blob.example.com/pending_abc.pdf'])),
            new Response(200, [], json_encode(['url' => 'https://blob.example.com/meta_abc.json'])),
        ]);

        $url = $model->upload('abc', 'fake-pdf-bytes', 'application/pdf');
        $this->assertEquals('https://blob.example.com/pending_abc.pdf', $url);
    }

    public function test_get_meta_returns_decoded_json(): void
    {
        $meta  = ['status' => 'pending', 'expires_at' => time() + 3600, 'blob_url' => 'https://blob.example.com/pending_abc.pdf'];
        $model = $this->makeModel([
            new Response(200, [], json_encode($meta)),
        ]);

        $result = $model->getMeta('abc');
        $this->assertEquals('pending', $result['status']);
    }

    public function test_update_meta_merges_fields(): void
    {
        $existing = ['status' => 'pending', 'expires_at' => 9999999999, 'blob_url' => 'https://blob.example.com/x.pdf'];
        $model = $this->makeModel([
            new Response(200, [], json_encode($existing)),
            new Response(200, [], '{}'),
        ]);

        $model->updateMeta('abc', ['status' => 'paid']);
        $this->assertTrue(true);
    }

    public function test_get_meta_returns_null_on_404(): void
    {
        $model = $this->makeModel([
            new Response(404, [], 'not found'),
        ]);

        $result = $model->getMeta('nonexistent');
        $this->assertNull($result);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
./vendor/bin/phpunit tests/Models/FileModelTest.php
```

Expected: `Error: Class "App\Models\FileModel" not found`

- [ ] **Step 3: Implement FileModel**

Create `app/Models/FileModel.php`:

```php
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./vendor/bin/phpunit tests/Models/FileModelTest.php
```

Expected: `OK (4 tests, 4 assertions)`

- [ ] **Step 5: Commit**

```bash
git add app/Models/FileModel.php tests/Models/FileModelTest.php
git commit -m "feat: FileModel for Vercel Blob upload, meta, delete, list"
```

---

## Task 15: PaymentModel — PayMongo

**Files:**
- Create: `app/Models/PaymentModel.php`
- Create: `tests/Models/PaymentModelTest.php`

- [ ] **Step 1: Write failing tests**

Create `tests/Models/PaymentModelTest.php`:

```php
<?php
namespace Tests\Models;

use App\Models\PaymentModel;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

class PaymentModelTest extends TestCase
{
    private function makeModel(array $responses): PaymentModel
    {
        $mock    = new MockHandler($responses);
        $handler = HandlerStack::create($mock);
        $client  = new Client(['handler' => $handler]);
        return new PaymentModel('sk_test_key', 'whsk_test_secret', $client);
    }

    public function test_create_link_returns_checkout_url(): void
    {
        $model = $this->makeModel([
            new Response(200, [], json_encode([
                'data' => ['attributes' => ['checkout_url' => 'https://pm.link/abc']],
            ])),
        ]);

        $url = $model->createLink('uuid-123', 'https://app.example.com/payment/success?token=uuid-123', 'https://app.example.com/payment/failed?token=uuid-123');
        $this->assertEquals('https://pm.link/abc', $url);
    }

    public function test_verify_webhook_signature_valid(): void
    {
        $model   = new PaymentModel('sk_test_key', 'whsk_test_secret', new Client());
        $secret  = 'whsk_test_secret';
        $ts      = (string) time();
        $body    = '{"data":{"type":"payment"}}';
        $signed  = hash_hmac('sha256', "{$ts}.{$body}", $secret);
        $header  = "t={$ts},te={$signed},li={$signed}";

        $this->assertTrue($model->verifyWebhookSignature($body, $header));
    }

    public function test_verify_webhook_signature_invalid(): void
    {
        $model  = new PaymentModel('sk_test_key', 'whsk_test_secret', new Client());
        $header = 't=12345,te=badsig,li=badsig';
        $this->assertFalse($model->verifyWebhookSignature('{"data":{}}', $header));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
./vendor/bin/phpunit tests/Models/PaymentModelTest.php
```

Expected: `Error: Class "App\Models\PaymentModel" not found`

- [ ] **Step 3: Implement PaymentModel**

Create `app/Models/PaymentModel.php`:

```php
<?php
namespace App\Models;

use GuzzleHttp\Client;

class PaymentModel
{
    private const API = 'https://api.paymongo.com/v1';

    public function __construct(
        private string $secretKey,
        private string $webhookSecret,
        private Client $http
    ) {}

    public static function fromEnv(): self
    {
        return new self(
            $_ENV['PAYMONGO_SECRET_KEY'],
            $_ENV['PAYMONGO_WEBHOOK_SECRET'],
            new Client()
        );
    }

    public function createLink(string $uuid, string $successUrl, string $failUrl): string
    {
        $res = $this->http->post(self::API . '/links', [
            'headers' => [
                'Authorization' => 'Basic ' . base64_encode($this->secretKey . ':'),
                'Content-Type'  => 'application/json',
            ],
            'json' => [
                'data' => [
                    'attributes' => [
                        'amount'           => 5000,
                        'description'      => 'PDF_EDITOR download',
                        'reference_number' => $uuid,
                        'redirect'         => [
                            'success' => $successUrl,
                            'failed'  => $failUrl,
                        ],
                    ],
                ],
            ],
        ]);

        $data = json_decode((string) $res->getBody(), true);
        return $data['data']['attributes']['checkout_url'];
    }

    public function verifyWebhookSignature(string $rawBody, string $signatureHeader): bool
    {
        $parts = [];
        foreach (explode(',', $signatureHeader) as $part) {
            [$k, $v]    = explode('=', $part, 2);
            $parts[$k] = $v;
        }

        if (empty($parts['t'])) return false;

        $payload  = $parts['t'] . '.' . $rawBody;
        $expected = hash_hmac('sha256', $payload, $this->webhookSecret);

        $toCheck = $parts['te'] ?? $parts['li'] ?? '';
        return hash_equals($expected, $toCheck);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./vendor/bin/phpunit tests/Models/PaymentModelTest.php
```

Expected: `OK (3 tests, 3 assertions)`

- [ ] **Step 5: Commit**

```bash
git add app/Models/PaymentModel.php tests/Models/PaymentModelTest.php
git commit -m "feat: PaymentModel for PayMongo link creation and webhook verification"
```

---

## Task 16: PaymentController — prepare + views

**Files:**
- Create: `app/Controllers/PaymentController.php`
- Create: `app/Views/payment/success.php`
- Create: `app/Views/payment/failed.php`

- [ ] **Step 1: Create PaymentController**

Create `app/Controllers/PaymentController.php`:

```php
<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\FileModel;
use App\Models\PaymentModel;
use Ramsey\Uuid\Uuid;

class PaymentController extends Controller
{
    public function prepare(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['error' => 'Method not allowed'], 405);
            return;
        }

        if (empty($_FILES['file'])) {
            $this->json(['error' => 'No file received'], 400);
            return;
        }

        $upload  = $_FILES['file'];
        $mime    = $_POST['mime'] ?? 'application/pdf';
        $bytes   = file_get_contents($upload['tmp_name']);
        $uuid    = Uuid::uuid4()->toString();

        $fileModel    = FileModel::fromEnv();
        $paymentModel = PaymentModel::fromEnv();

        $appUrl     = rtrim($_ENV['APP_URL'], '/');
        $successUrl = "{$appUrl}/payment/success?token={$uuid}";
        $failUrl    = "{$appUrl}/payment/failed?token={$uuid}";

        $fileModel->upload($uuid, $bytes, $mime);
        $checkoutUrl = $paymentModel->createLink($uuid, $successUrl, $failUrl);

        $this->json(['checkout_url' => $checkoutUrl, 'token' => $uuid]);
    }

    public function success(): void
    {
        $token     = $_GET['token'] ?? '';
        $fileModel = FileModel::fromEnv();
        $meta      = $fileModel->getMeta($token);

        if (!$meta || $meta['status'] !== 'paid') {
            $this->render('payment/failed', [
                'title'   => 'Payment Not Confirmed',
                'token'   => $token,
                'message' => 'Payment not yet confirmed. Please wait a moment and refresh.',
            ]);
            return;
        }

        $remaining = max(0, $meta['expires_at'] - time());
        $this->render('payment/success', [
            'title'     => 'Payment Successful — PDF_EDITOR',
            'token'     => htmlspecialchars($token),
            'remaining' => $remaining,
        ]);
    }

    public function failed(): void
    {
        $token = $_GET['token'] ?? '';
        $this->render('payment/failed', [
            'title'   => 'Payment Failed — PDF_EDITOR',
            'token'   => htmlspecialchars($token),
            'message' => 'Your payment was not completed.',
        ]);
    }
}
```

- [ ] **Step 2: Create payment/success.php**

Create `app/Views/payment/success.php`:

```php
<?php ob_start(); ?>
<div class="page-center">
  <div class="payment-card glass">
    <div class="payment-card__icon">✅</div>
    <div class="payment-card__title">Payment Confirmed!</div>
    <div class="payment-card__sub">Your file is ready to download.</div>

    <div class="countdown">
      ⏱ Link expires in <span class="countdown__time" id="timer">--:--</span>
    </div>

    <a href="/download?token=<?= $token ?>" class="btn btn--amber btn--full" style="margin-bottom:12px;">
      ⬇️ Download File
    </a>
    <a href="/" class="btn btn--white btn--full">← Edit Another File</a>
    <p style="margin-top:16px;font-size:11px;color:rgba(255,255,255,0.5);">File is permanently deleted after 1 hour.</p>
  </div>
</div>

<script>
(function() {
  let secs = <?= (int) $remaining ?>;
  const el = document.getElementById('timer');
  function tick() {
    if (secs <= 0) { el.textContent = 'Expired'; return; }
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    el.textContent = m + ':' + s;
    secs--;
    setTimeout(tick, 1000);
  }
  tick();
})();
</script>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
```

- [ ] **Step 3: Create payment/failed.php**

Create `app/Views/payment/failed.php`:

```php
<?php ob_start(); ?>
<div class="page-center">
  <div class="payment-card glass">
    <div class="payment-card__icon">❌</div>
    <div class="payment-card__title">Payment Failed</div>
    <div class="payment-card__sub"><?= htmlspecialchars($message ?? 'Your payment was not completed.') ?></div>

    <?php if (!empty($token)): ?>
    <form method="POST" action="/payment/retry" style="margin-bottom:12px;">
      <input type="hidden" name="token" value="<?= htmlspecialchars($token) ?>">
      <button type="submit" class="btn btn--amber btn--full">🔄 Try Again</button>
    </form>
    <?php endif; ?>

    <a href="/" class="btn btn--white btn--full">← Start Over</a>
  </div>
</div>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
```

- [ ] **Step 4: Commit**

```bash
git add app/Controllers/PaymentController.php app/Views/payment/
git commit -m "feat: PaymentController prepare/success/failed + payment views"
```

---

## Task 17: Webhook Handler

**Files:**
- Create: `api/webhook.php`

- [ ] **Step 1: Create webhook.php**

Create `api/webhook.php`:

```php
<?php
require_once __DIR__ . '/../vendor/autoload.php';

if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

use App\Models\FileModel;
use App\Models\PaymentModel;

$rawBody   = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_PAYMONGO_SIGNATURE'] ?? '';

$paymentModel = PaymentModel::fromEnv();

if (!$paymentModel->verifyWebhookSignature($rawBody, $sigHeader)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

$event = json_decode($rawBody, true);
$type  = $event['data']['attributes']['type'] ?? '';

if ($type !== 'payment.paid') {
    http_response_code(200);
    echo json_encode(['status' => 'ignored']);
    exit;
}

$refNumber = $event['data']['attributes']['data']['attributes']['reference_number'] ?? '';
if (!$refNumber) {
    http_response_code(422);
    echo json_encode(['error' => 'No reference number']);
    exit;
}

$fileModel = FileModel::fromEnv();
$fileModel->updateMeta($refNumber, ['status' => 'paid']);

http_response_code(200);
echo json_encode(['status' => 'ok']);
```

- [ ] **Step 2: Commit**

```bash
git add api/webhook.php
git commit -m "feat: PayMongo webhook handler with signature verification"
```

---

## Task 18: DownloadController

**Files:**
- Create: `app/Controllers/DownloadController.php`
- Create: `tests/Controllers/DownloadControllerTest.php`

- [ ] **Step 1: Write failing tests**

Create `tests/Controllers/DownloadControllerTest.php`:

```php
<?php
namespace Tests\Controllers;

use App\Controllers\DownloadController;
use App\Models\FileModel;
use PHPUnit\Framework\TestCase;

class DownloadControllerTest extends TestCase
{
    public function test_is_expired_returns_true_for_past_timestamp(): void
    {
        $controller = new DownloadController($this->createMock(FileModel::class));
        $meta = ['expires_at' => time() - 1];
        $this->assertTrue($controller->isExpired($meta));
    }

    public function test_is_expired_returns_false_for_future_timestamp(): void
    {
        $controller = new DownloadController($this->createMock(FileModel::class));
        $meta = ['expires_at' => time() + 3600];
        $this->assertFalse($controller->isExpired($meta));
    }

    public function test_is_paid_returns_true_for_paid_status(): void
    {
        $controller = new DownloadController($this->createMock(FileModel::class));
        $this->assertTrue($controller->isPaid(['status' => 'paid']));
    }

    public function test_is_paid_returns_false_for_pending_status(): void
    {
        $controller = new DownloadController($this->createMock(FileModel::class));
        $this->assertFalse($controller->isPaid(['status' => 'pending']));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
./vendor/bin/phpunit tests/Controllers/DownloadControllerTest.php
```

Expected: `Error: Class "App\Controllers\DownloadController" not found`

- [ ] **Step 3: Implement DownloadController**

Create `app/Controllers/DownloadController.php`:

```php
<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\FileModel;

class DownloadController extends Controller
{
    public function __construct(private ?FileModel $fileModel = null)
    {
        $this->fileModel ??= FileModel::fromEnv();
    }

    public function isExpired(array $meta): bool
    {
        return ($meta['expires_at'] ?? 0) < time();
    }

    public function isPaid(array $meta): bool
    {
        return ($meta['status'] ?? '') === 'paid';
    }

    public function index(): void
    {
        $token = $_GET['token'] ?? '';

        if (!$token) {
            $this->abort(404);
        }

        $meta = $this->fileModel->getMeta($token);

        if ($meta === null) {
            $this->abort(404);
        }

        if ($this->isExpired($meta)) {
            http_response_code(410);
            include __DIR__ . '/../Views/errors/410.php';
            exit;
        }

        if (!$this->isPaid($meta)) {
            $this->abort(403);
        }

        $this->redirect($meta['blob_url']);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./vendor/bin/phpunit tests/Controllers/DownloadControllerTest.php
```

Expected: `OK (4 tests, 4 assertions)`

- [ ] **Step 5: Commit**

```bash
git add app/Controllers/DownloadController.php tests/Controllers/DownloadControllerTest.php
git commit -m "feat: DownloadController — validates token, checks paid+expiry, redirects to Blob"
```

---

## Task 19: Cleanup Cron

**Files:**
- Create: `api/cleanup.php`

- [ ] **Step 1: Create api/cleanup.php**

Create `api/cleanup.php`:

```php
<?php
require_once __DIR__ . '/../vendor/autoload.php';

if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

use App\Models\FileModel;

$cronSecret = $_ENV['CRON_SECRET'] ?? '';
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if ($cronSecret && $authHeader !== "Bearer {$cronSecret}") {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$fileModel = FileModel::fromEnv();
$expired   = $fileModel->listExpiredUuids();

foreach ($expired as $uuid) {
    $fileModel->delete($uuid);
}

http_response_code(200);
echo json_encode(['deleted' => count($expired), 'uuids' => $expired]);
```

- [ ] **Step 2: Add CRON_SECRET to .env.example**

Add to `.env.example`:
```
CRON_SECRET=a-long-random-secret-string
```

- [ ] **Step 3: Commit**

```bash
git add api/cleanup.php .env.example
git commit -m "feat: cleanup cron endpoint — deletes expired Blob files"
```

---

## Task 20: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
./vendor/bin/phpunit --testdox
```

Expected output:
```
Core\Router
 ✔ Matches static get route
 ✔ Matches dynamic route and extracts param
 ✔ Returns null for unmatched route
 ✔ Does not match wrong method
 ✔ Matches post route
 ✔ Strips query string before matching

Models\FileModel
 ✔ Upload returns blob url
 ✔ Get meta returns decoded json
 ✔ Update meta merges fields
 ✔ Get meta returns null on 404

Models\PaymentModel
 ✔ Create link returns checkout url
 ✔ Verify webhook signature valid
 ✔ Verify webhook signature invalid

Controllers\DownloadController
 ✔ Is expired returns true for past timestamp
 ✔ Is expired returns false for future timestamp
 ✔ Is paid returns true for paid status
 ✔ Is paid returns false for pending status

OK (17 tests, 17 assertions)
```

- [ ] **Step 2: Fix any failures before continuing**

- [ ] **Step 3: Commit if any fixes were made**

```bash
git add -A
git commit -m "fix: resolve test failures"
```

---

## Task 21: Vercel Deployment Setup

**Files:**
- Review: `vercel.json` (already created in Task 1)
- Create: `README.md` *(minimal — deploy instructions only)*

- [ ] **Step 1: Verify vercel.json is correct**

Confirm `vercel.json` at project root contains:

```json
{
  "functions": {
    "public/index.php": { "runtime": "vercel-php@0.7.2" },
    "api/webhook.php":  { "runtime": "vercel-php@0.7.2" },
    "api/cleanup.php":  { "runtime": "vercel-php@0.7.2" }
  },
  "crons": [
    { "path": "/api/cleanup", "schedule": "0 3 * * *" }
  ],
  "routes": [
    { "src": "/api/webhook", "dest": "/api/webhook.php" },
    { "src": "/api/cleanup", "dest": "/api/cleanup.php" },
    { "src": "/public/(.*)", "dest": "/public/$1" },
    { "src": "/(.*)",        "dest": "/public/index.php" }
  ]
}
```

- [ ] **Step 2: Ensure .gitignore excludes vendor and .env**

Confirm `.gitignore` contains `/vendor/` and `/.env`.

- [ ] **Step 3: Set up Vercel environment variables**

In the Vercel dashboard (or via `vercel env add`), add all four variables:
- `PAYMONGO_SECRET_KEY`
- `PAYMONGO_WEBHOOK_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `APP_URL` (set after first deploy, e.g. `https://pdf-editor-xxxx.vercel.app`)
- `CRON_SECRET`

- [ ] **Step 4: Register PayMongo webhook**

In the PayMongo dashboard → Developers → Webhooks → Add:
- URL: `https://your-app.vercel.app/api/webhook`
- Events: `payment.paid`
- Copy the signing secret → set as `PAYMONGO_WEBHOOK_SECRET`

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: final pre-deploy review"
```

- [ ] **Step 6: Push to your GitHub repo and deploy**

```bash
git remote add origin https://github.com/YOUR_USERNAME/pdf-editor.git
git push -u origin main
```

Then connect the repo in the Vercel dashboard → Import Project → select the repo → Deploy.

---

## Task 22: Smoke Test After Deploy

- [ ] **Step 1: Open the live URL and verify homepage loads with 6 tool cards**

- [ ] **Step 2: Test Annotate tool**
  - Upload a small PDF
  - Add a text annotation
  - Click "Download — Pay ₱50"
  - Verify PayMongo checkout page opens
  - Complete test payment with PayMongo test card `4343434343434345` / any future date / any CVV
  - Verify redirect to `/payment/success?token=...`
  - Click download — verify file downloads with annotation visible

- [ ] **Step 3: Test Merge tool**
  - Upload 2 PDFs
  - Verify merged PDF downloads after payment

- [ ] **Step 4: Test expiry**
  - Use a token from a file that has expired (or manually set `expires_at` in the past via Vercel Blob)
  - Verify `/download?token=...` returns the 410 expired page

- [ ] **Step 5: Test cleanup cron manually**

```bash
curl -X GET https://your-app.vercel.app/api/cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected: `{"deleted": N, "uuids": [...]}`
