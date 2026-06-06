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
