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
