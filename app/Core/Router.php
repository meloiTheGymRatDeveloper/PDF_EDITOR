<?php
namespace App\Core;

class Router
{
    private array $routes = [];

    public function get(string $path, array $handler): void
    {
        if (count($handler) !== 2 || !is_string($handler[0]) || !is_string($handler[1])) {
            throw new \InvalidArgumentException('Handler must be [ClassName, methodName]');
        }
        $this->routes[] = ['method' => 'GET', 'path' => $path, 'handler' => $handler];
    }

    public function post(string $path, array $handler): void
    {
        if (count($handler) !== 2 || !is_string($handler[0]) || !is_string($handler[1])) {
            throw new \InvalidArgumentException('Handler must be [ClassName, methodName]');
        }
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

        if (!class_exists($class) || !method_exists($class, $method_name)) {
            http_response_code(500);
            echo '<h1>500 — Internal Server Error</h1>';
            return;
        }

        try {
            $controller = new $class();
            $controller->$method_name(...array_values($match['params']));
        } catch (\Throwable $e) {
            http_response_code(500);
            $isApi = str_starts_with(strtok($uri, '?'), '/payment/') || str_starts_with(strtok($uri, '?'), '/download');
            if ($isApi) {
                header('Content-Type: application/json');
                echo json_encode(['error' => $e->getMessage()]);
            } else {
                echo '<h1>500 — Internal Server Error</h1>';
            }
        }
    }
}
