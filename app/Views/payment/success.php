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
