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
