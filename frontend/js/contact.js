(async function () {
    startPresenceTracking('contact');

    try {
        const res = await fetch(`${API_BASE_URL}/site`);
        if (!res.ok) throw new Error('Instellingen niet gevonden');
        const data = await res.json();

        const introEl = document.getElementById('contact-intro');
        if (introEl) introEl.textContent = data.contactIntro || '';

        const emailLink = document.getElementById('contact-email-link');
        const emailRow = document.getElementById('contact-email-row');
        if (data.contactEmail && emailLink && emailRow) {
            emailLink.textContent = data.contactEmail;
            emailLink.href = `mailto:${data.contactEmail}`;
            emailRow.style.display = '';
        }

        const phoneText = document.getElementById('contact-phone-text');
        const phoneRow = document.getElementById('contact-phone-row');
        if (data.contactPhone && phoneText && phoneRow) {
            phoneText.textContent = data.contactPhone;
            phoneRow.style.display = '';
        }

        const addressText = document.getElementById('contact-address-text');
        const addressRow = document.getElementById('contact-address-row');
        if (data.contactAddress && addressText && addressRow) {
            addressText.innerHTML = data.contactAddress.replace(/\n/g, '<br>');
            addressRow.style.display = '';
        }
    } catch (e) {
        // Stille fout: pagina blijft leeg maar werkt wel
    }
})();
