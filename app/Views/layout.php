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
