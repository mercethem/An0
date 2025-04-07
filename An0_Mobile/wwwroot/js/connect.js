// An0 Bağlantı Ekranı JavaScript

// DOM yüklendikten sonra çalışacak olan başlangıç fonksiyonu
function initConnectPage() {
    // DOM elementleri
    const connectForm = document.querySelector('form');
    const connectionIdInput = document.getElementById('ConnectionId');
    const sharedPasswordInput = document.getElementById('SharedPassword');
    
    // Form gönderildiğinde
    connectForm.addEventListener('submit', function(e) {
        // Form geçerli mi kontrol et
        if (!validateForm()) {
            e.preventDefault();
            return false;
        }
        
        // Kullanıcı bilgilerini sakla
        localStorage.setItem('lastConnectionId', connectionIdInput.value);
    });
    
    // Sayfa yüklendiğinde
    window.addEventListener('load', function() {
        // Son kullanılan kullanıcı adını doldur
        const lastConnectionId = localStorage.getItem('lastConnectionId');
        if (lastConnectionId) {
            connectionIdInput.value = lastConnectionId;
        } else {
            // Rasgele bir kullanıcı adı oluştur
            connectionIdInput.value = 'user_' + Math.random().toString(36).substring(2, 8);
        }
        
        // Şifre alanına odaklan
        sharedPasswordInput.focus();
    });
    
    // Form doğrulama fonksiyonu
    function validateForm() {
        let isValid = true;
        
        // Kullanıcı adı kontrolü
        if (!connectionIdInput.value.trim()) {
            showError(connectionIdInput, 'Kullanıcı adı gereklidir.');
            isValid = false;
        } else {
            removeError(connectionIdInput);
        }
        
        // Şifre kontrolü
        if (!sharedPasswordInput.value.trim()) {
            showError(sharedPasswordInput, 'Şifre gereklidir.');
            isValid = false;
        } else if (sharedPasswordInput.value.length < 6) {
            showError(sharedPasswordInput, 'Şifre en az 6 karakter olmalıdır.');
            isValid = false;
        } else {
            removeError(sharedPasswordInput);
        }
        
        return isValid;
    }
    
    // Hata mesajı göster
    function showError(input, message) {
        const formGroup = input.closest('.mb-3');
        const errorSpan = formGroup.querySelector('.text-danger') || document.createElement('span');
        
        errorSpan.className = 'text-danger d-block mt-1';
        errorSpan.textContent = message;
        
        if (!formGroup.querySelector('.text-danger')) {
            formGroup.appendChild(errorSpan);
        }
        
        input.classList.add('is-invalid');
    }
    
    // Hata mesajını kaldır
    function removeError(input) {
        const formGroup = input.closest('.mb-3');
        const errorSpan = formGroup.querySelector('.text-danger');
        
        if (errorSpan) {
            errorSpan.remove();
        }
        
        input.classList.remove('is-invalid');
    }
}

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', function() {
    // Bağlantı sayfasında olup olmadığını kontrol et
    if (document.querySelector('form[asp-action="Connect"]')) {
        initConnectPage();
    }
}); 