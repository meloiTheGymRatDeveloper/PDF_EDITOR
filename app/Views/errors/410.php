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
