// Global variables
let platforms = JSON.parse(localStorage.getItem('p2pPlatforms')) || {};
let currentPlatform = null;
let editingLoanId = null;
let deferredPrompt = null;
let platformChart, categoryChart, returnsChart;
let platformSearchTerm = '';
let loanSearchTerm = '';

// Currency configuration
const CURRENCIES = {
    EUR: "€",
    GBP: "£",
    JPY: "¥",
};
let currentCurrency = localStorage.getItem('selectedCurrency') || 'EUR';

// Currency functions
function changeCurrency(currency) {
    currentCurrency = currency;
    localStorage.setItem('selectedCurrency', currency);
    document.getElementById('currencySelector').value = currency;
    updatePortfolioSummary();
    renderPlatforms();
    if (currentPlatform) {
        updateModalStats();
    }
    initializeCharts();
}

function formatCurrency(amount) {
    const symbol = CURRENCIES[currentCurrency];
    let formattedAmount;

    if (currentCurrency === "EUR" || currentCurrency === "GBP") {
        formattedAmount = Number(amount).toLocaleString("en-GB", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return symbol + formattedAmount; // €1,234.56 or £1,234.56
    } else if (currentCurrency === "JPY") {
        formattedAmount = Number(amount).toLocaleString("ja-JP", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        return symbol + formattedAmount; // ¥1,234
    }

    // fallback
    formattedAmount = Number(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return symbol + formattedAmount;
}


// Chart functions
function initializeCharts() {
    const platformNames = Object.keys(platforms);
    if (platformNames.length === 0) return;

    // Get current text color for charts
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();

    const chartConfig = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: textColor,
                    font: { size: 12 },
                    padding: 15
                }
            },
            tooltip: {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-white').trim(),
                titleColor: textColor,
                bodyColor: textColor,
                borderColor: gridColor,
                borderWidth: 1
            }
        }
    };

    // Platform Investment Chart
    const platformInvestments = platformNames.map(name => {
        const stats = calculatePlatformStats(name);
        return stats.totalInvested;
    });

    const ctx1 = document.getElementById('platformChart');
    if (ctx1) {
        if (platformChart) platformChart.destroy();
        platformChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: platformNames,
                datasets: [{
                    data: platformInvestments,
                    backgroundColor: ['#667eea', '#764ba2', '#4caf50', '#ff9800', '#2196f3', '#f44336', '#9c27b0']
                }]
            },
            options: chartConfig
        });
    }

    // Category Chart
    let categoryBreakdown = { personal: 0, business: 0, real_estate: 0, auto: 0, other: 0 };
    platformNames.forEach(platform => {
        platforms[platform].loans.forEach(loan => {
            const category = loan.category || 'other';
            categoryBreakdown[category] = (categoryBreakdown[category] || 0) + loan.amount;
        });
    });

    const ctx2 = document.getElementById('categoryChart');
    if (ctx2) {
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(ctx2, {
            type: 'pie',
            data: {
                labels: ['Personal', 'Business', 'Real Estate', 'Auto', 'Other'],
                datasets: [{
                    data: [
                        categoryBreakdown.personal,
                        categoryBreakdown.business,
                        categoryBreakdown.real_estate,
                        categoryBreakdown.auto,
                        categoryBreakdown.other
                    ],
                    backgroundColor: ['#2196F3', '#FF9800', '#4CAF50', '#9C27B0', '#607D8B']
                }]
            },
            options: chartConfig
        });
    }

    // Returns Chart
    const returnsData = platformNames.map(name => {
        const stats = calculatePlatformStats(name);
        return stats.totalInterestEarned;
    });

    const ctx3 = document.getElementById('returnsChart');
    if (ctx3) {
        if (returnsChart) returnsChart.destroy();
        returnsChart = new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: platformNames,
                datasets: [{
                    label: 'Interest Earned',
                    data: returnsData,
                    backgroundColor: '#4caf50',
                    borderColor: '#388e3c',
                    borderWidth: 2
                }]
            },
            options: {
                ...chartConfig,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            callback: function (value) {
                                return formatCurrency(value);
                            }
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    }
                }
            }
        });
    }
}

// Payment notifications
function checkPaymentDues() {
    const today = new Date();
    const alertsContainer = document.getElementById('paymentAlerts');
    alertsContainer.innerHTML = '';
    let upcomingPayments = [];


    Object.keys(platforms).forEach(platformName => {
        platforms[platformName].loans.forEach(loan => {
            const lastPaymentDate = new Date(loan.lastPaymentDate);
            const daysUntilDue = Math.ceil((lastPaymentDate - today) / (1000 * 60 * 60 * 24));

            if (daysUntilDue >= 0 && daysUntilDue <= 30) {
                upcomingPayments.push({
                    platform: platformName,
                    description: loan.description,
                    daysUntilDue: daysUntilDue,
                    amount: loan.paymentAmount || 0
                });
            }
        });
    });

    // Sort by days until due
    upcomingPayments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    upcomingPayments.forEach((payment, index) => {
        const alertDiv = document.createElement('div');
        const bgColor = payment.daysUntilDue <= 7 ? 'var(--error-color)' : 'var(--warning-color)';
        alertDiv.style.cssText = `
            background: ${bgColor};
            color: white;
            padding: 12px 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            font-size: 0.9em;
            animation: slideIn 0.3s ease-out;
            max-width: 350px;
        `;
        alertDiv.innerHTML = `
  <strong>${payment.description}</strong><br>
  Due in ${payment.daysUntilDue} days on ${payment.platform}
  <button class="close-payment-alert" style="float: right; background: none; border: none; color: white; font-size: 1.2em; cursor: pointer;">&times;</button>
`;
        // Add handler to close the alert
        alertDiv.querySelector('.close-payment-alert').onclick = function () {
            alertDiv.remove();
        };
        alertsContainer.appendChild(alertDiv);

    });
    const hasAlerts = document.getElementById('paymentAlerts').children.length > 0;
    document.getElementById('dismissAllPayments').style.display = hasAlerts ? 'block' : 'none';

}

// Theme Toggle
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');

    body.classList.toggle('dark-mode');

    if (body.classList.contains('dark-mode')) {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
        localStorage.setItem('theme', 'dark');
        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#1a1a2e');
    } else {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Night Mode';
        localStorage.setItem('theme', 'light');
        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#667eea');
    }
    initializeCharts();
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('themeIcon').textContent = '☀️';
        document.getElementById('themeText').textContent = 'Light Mode';
        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#1a1a2e');
    }
}

// PWA Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// Show install prompt after 3 seconds on mobile
setTimeout(() => {
    const isInstallPromptDismissed = localStorage.getItem('installPromptDismissed');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isMobile && !isStandalone && !isInstallPromptDismissed) {
        document.getElementById('installPrompt').classList.add('show');
    }
}, 3000);

function installApp() {
    const installPrompt = document.getElementById('installPrompt');

    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showNotification('App installed successfully!', 'success');
            }
            deferredPrompt = null;
            installPrompt.classList.remove('show');
            localStorage.setItem('installPromptDismissed', 'true');
        });
    } else {
        showNotification('To install: Tap Share button and select "Add to Home Screen"', 'success');
        installPrompt.classList.remove('show');
        localStorage.setItem('installPromptDismissed', 'true');
    }
}

function dismissInstallPrompt() {
    document.getElementById('installPrompt').classList.remove('show');
    localStorage.setItem('installPromptDismissed', 'true');
}

function resetAllData() {
    if (confirm('⚠️ WARNING: This will permanently delete all your platforms and loans.\n\nAre you absolutely sure you want to reset all data?')) {
        if (confirm('This action cannot be undone! Click OK to confirm deletion of ALL data.')) {
            platforms = {};
            localStorage.removeItem('p2pPlatforms');
            savePlatforms();
            showNotification('All data has been reset', 'success');
        }
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function exportData() {
    try {
        const dataStr = JSON.stringify(platforms, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        const date = new Date().toISOString().split('T')[0];
        link.download = `p2p-lending-data-${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showNotification('Data exported successfully!', 'success');
    } catch (error) {
        showNotification('Error exporting data: ' + error.message, 'error');
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (typeof importedData !== 'object' || importedData === null) {
                throw new Error('Invalid data format');
            }

            const hasExistingData = Object.keys(platforms).length > 0;

            if (hasExistingData) {
                const confirmMessage = 'You have existing data. Do you want to:\n\n' +
                    'OK = Replace all data with imported data\n' +
                    'Cancel = Merge imported data with existing data';

                if (confirm(confirmMessage)) {
                    platforms = importedData;
                } else {
                    Object.keys(importedData).forEach(platformName => {
                        if (platforms[platformName]) {
                            const existingLoans = platforms[platformName].loans || [];
                            const importedLoans = importedData[platformName].loans || [];
                            platforms[platformName].loans = [...existingLoans, ...importedLoans];
                        } else {
                            platforms[platformName] = importedData[platformName];
                        }
                    });
                }
            } else {
                platforms = importedData;
            }

            savePlatforms();
            showNotification('Data imported successfully!', 'success');

        } catch (error) {
            showNotification('Error importing data: ' + error.message, 'error');
        }
    };

    reader.onerror = function () {
        showNotification('Error reading file', 'error');
    };

    reader.readAsText(file);
    event.target.value = '';
}

function calculatePaymentCount(firstDate, lastDate, frequency) {
    if (!firstDate || !lastDate) return 0;

    const first = new Date(firstDate);
    const last = new Date(lastDate);

    const diffTime = Math.abs(last - first);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let count = 0;
    switch (frequency) {
        case 'daily':
            count = diffDays + 1;
            break;
        case 'weekly':
            count = Math.floor(diffDays / 7) + 1;
            break;
        case 'monthly':
            count = (last.getFullYear() - first.getFullYear()) * 12 +
                (last.getMonth() - first.getMonth()) + 1;
            break;
        case 'quarterly':
            count = Math.floor(((last.getFullYear() - first.getFullYear()) * 12 +
                (last.getMonth() - first.getMonth())) / 3) + 1;
            break;
        case 'yearly':
            count = (last.getFullYear() - first.getFullYear()) + 1;
            break;
    }

    return Math.max(1, count);
}

function calculateFixedPrincipal() {
    const firstDate = document.getElementById('firstPaymentDate').value;
    const lastDate = document.getElementById('lastPaymentDate').value;
    const frequency = document.getElementById('fixedPrincipalFrequency').value;
    const principalPer = parseFloat(document.getElementById('principalPerPayment').value);
    const totalInterest = parseFloat(document.getElementById('totalInterest').value);
    const amount = parseFloat(document.getElementById('loanAmount').value);

    if (firstDate && lastDate && frequency && principalPer && totalInterest) {
        const count = calculatePaymentCount(firstDate, lastDate, frequency);
        const display = document.getElementById('fixedPrincipalInfo');
        const infoDisplay = document.getElementById('fixedPrincipalDisplay');

        if (count > 0) {
            const regularPayments = count - 1;
            const regularPrincipalTotal = principalPer * regularPayments;
            const remainingPrincipal = amount ? (amount - regularPrincipalTotal) : 0;
            const totalReturn = amount + totalInterest;

            infoDisplay.innerHTML = `${regularPayments} payments of ${formatCurrency(principalPer)} (principal only)<br>` +
                `Last payment: ${formatCurrency(remainingPrincipal + totalInterest)} (${formatCurrency(remainingPrincipal)} remaining principal + ${formatCurrency(totalInterest)} total interest)<br>` +
                `<strong>Total return: ${formatCurrency(totalReturn)}</strong>`;
            display.style.display = 'block';
        } else {
            display.style.display = 'none';
        }
    }
}

function calculatePayments() {
    const firstDate = document.getElementById('firstPaymentDate').value;
    const lastDate = document.getElementById('lastPaymentDate').value;
    const frequency = document.getElementById('paymentFrequency').value;
    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);

    if (firstDate && lastDate && frequency) {
        const count = calculatePaymentCount(firstDate, lastDate, frequency);
        const display = document.getElementById('calculatedInfo');
        const countDisplay = document.getElementById('paymentCountDisplay');

        if (paymentAmount && count > 0) {
            const total = paymentAmount * count;
            countDisplay.textContent = `${count} payments of ${formatCurrency(paymentAmount)} = ${formatCurrency(total)} total`;
            display.style.display = 'block';
        } else if (count > 0) {
            countDisplay.textContent = `${count} payments`;
            display.style.display = 'block';
        } else {
            display.style.display = 'none';
        }
    }
}

function toggleFixedPrincipal() {
    const isChecked = document.getElementById('isFixedPrincipal').checked;
    const fixedOptions = document.getElementById('fixedPrincipalOptions');
    const bulletLoan = document.getElementById('isBulletLoan');
    const repeatPayment = document.getElementById('isRepeat');

    if (isChecked) {
        bulletLoan.checked = false;
        bulletLoan.disabled = true;
        repeatPayment.checked = false;
        repeatPayment.disabled = true;
        document.getElementById('repeatOptions').classList.remove('active');
    } else {
        bulletLoan.disabled = false;
        repeatPayment.disabled = false;
    }

    fixedOptions.classList.toggle('active', isChecked);
    calculateFixedPrincipal();
}

function toggleRepeat() {
    const isChecked = document.getElementById('isRepeat').checked;
    const repeatOptions = document.getElementById('repeatOptions');
    repeatOptions.classList.toggle('active', isChecked);
    updateInstallmentLabel();
    calculatePayments();
}

function toggleBulletLoan() {
    const isBullet = document.getElementById('isBulletLoan').checked;
    const isRepeat = document.getElementById('isRepeat');
    const isFixedPrincipal = document.getElementById('isFixedPrincipal');

    if (isBullet) {
        isFixedPrincipal.checked = false;
        isFixedPrincipal.disabled = true;
        document.getElementById('fixedPrincipalOptions').classList.remove('active');

        if (!isRepeat.checked) {
            isRepeat.checked = true;
            toggleRepeat();
        }
    } else {
        isFixedPrincipal.disabled = false;
    }
    updateInstallmentLabel();
}

function updateInstallmentLabel() {
    const isBullet = document.getElementById('isBulletLoan').checked;
    const label = document.getElementById('installmentLabel');
    if (isBullet) {
        label.textContent = 'Interest Payment';
    } else {
        label.textContent = 'Payment Amount';
    }
}

function savePlatforms() {
    localStorage.setItem('p2pPlatforms', JSON.stringify(platforms));
    renderPlatforms();
    updatePortfolioSummary();
    initializeCharts();
    checkPaymentDues();
}

function addPlatform() {
    const name = document.getElementById('platformName').value.trim();
    if (!name) {
        alert('Please enter a platform name');
        return;
    }
    if (platforms[name]) {
        alert('Platform already exists');
        return;
    }
    platforms[name] = { loans: [] };
    document.getElementById('platformName').value = '';
    savePlatforms();
}

function deletePlatform(platformName, event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete ${platformName} and all its loans?`)) {
        delete platforms[platformName];
        savePlatforms();
    }
}

function openPlatform(platformName) {
    currentPlatform = platformName;
    document.getElementById('modalTitle').textContent = platformName;
    updateModalStats();
    renderLoans();
    document.getElementById('loanModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('loanModal').style.display = 'none';
    currentPlatform = null;
    clearLoanForm();
}

function clearLoanForm() {
    editingLoanId = null;
    document.getElementById('loanDescription').value = '';
    document.getElementById('loanAmount').value = '';
    document.getElementById('loanCategory').value = 'personal';
    document.getElementById('firstPaymentDate').value = '';
    document.getElementById('lastPaymentDate').value = '';
    document.getElementById('isBulletLoan').checked = false;
    document.getElementById('isBulletLoan').disabled = false;
    document.getElementById('isFixedPrincipal').checked = false;
    document.getElementById('isFixedPrincipal').disabled = false;
    document.getElementById('isRepeat').checked = false;
    document.getElementById('isRepeat').disabled = false;
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentFrequency').value = 'monthly';
    document.getElementById('principalPerPayment').value = '';
    document.getElementById('totalInterest').value = '';
    document.getElementById('fixedPrincipalFrequency').value = 'monthly';
    document.getElementById('repeatOptions').classList.remove('active');
    document.getElementById('fixedPrincipalOptions').classList.remove('active');
    document.getElementById('calculatedInfo').style.display = 'none';
    document.getElementById('fixedPrincipalInfo').style.display = 'none';
    document.getElementById('formTitle').textContent = 'Add New Loan';
    document.getElementById('saveLoanBtn').textContent = 'Add Loan';
    document.getElementById('editModeBadge').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
    updateInstallmentLabel();
}

function editLoan(loanId) {
    const loan = platforms[currentPlatform].loans.find(l => l.id === loanId);
    if (!loan) return;

    editingLoanId = loanId;

    document.getElementById('loanDescription').value = loan.description;
    document.getElementById('loanAmount').value = loan.amount;
    document.getElementById('loanCategory').value = loan.category || 'personal';
    document.getElementById('firstPaymentDate').value = loan.firstPaymentDate;
    document.getElementById('lastPaymentDate').value = loan.lastPaymentDate;
    document.getElementById('isBulletLoan').checked = loan.isBullet || false;
    document.getElementById('isFixedPrincipal').checked = loan.isFixedPrincipal || false;
    document.getElementById('isRepeat').checked = loan.isRepeat || false;

    if (loan.isFixedPrincipal) {
        document.getElementById('principalPerPayment').value = loan.principalPerPayment;
        document.getElementById('totalInterest').value = loan.totalInterest;
        document.getElementById('fixedPrincipalFrequency').value = loan.fixedPrincipalFrequency;
        document.getElementById('fixedPrincipalOptions').classList.add('active');
        document.getElementById('isBulletLoan').disabled = true;
        document.getElementById('isRepeat').disabled = true;
        calculateFixedPrincipal();
    } else if (loan.isRepeat) {
        document.getElementById('paymentAmount').value = loan.paymentAmount;
        document.getElementById('paymentFrequency').value = loan.frequency;
        document.getElementById('repeatOptions').classList.add('active');
        calculatePayments();
    }

    if (loan.isBullet) {
        document.getElementById('isFixedPrincipal').disabled = true;
    }

    updateInstallmentLabel();

    document.getElementById('formTitle').textContent = 'Edit Loan';
    document.getElementById('saveLoanBtn').textContent = 'Update Loan';
    document.getElementById('editModeBadge').style.display = 'inline-block';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';

    document.querySelector('.loan-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
    clearLoanForm();
    renderLoans();
}

function saveLoan() {
    const description = document.getElementById('loanDescription').value.trim();
    const amount = parseFloat(document.getElementById('loanAmount').value);
    const category = document.getElementById('loanCategory').value;
    const firstDate = document.getElementById('firstPaymentDate').value;
    const lastDate = document.getElementById('lastPaymentDate').value;
    const isBullet = document.getElementById('isBulletLoan').checked;
    const isFixedPrincipal = document.getElementById('isFixedPrincipal').checked;
    const isRepeat = document.getElementById('isRepeat').checked;

    if (!description || !amount || !firstDate || !lastDate) {
        alert('Please fill in description, amount, first payment date, and last payment date');
        return;
    }

    const loan = {
        id: editingLoanId || Date.now(),
        description: description,
        amount: amount,
        category: category,
        firstPaymentDate: firstDate,
        lastPaymentDate: lastDate,
        isBullet: isBullet,
        isFixedPrincipal: isFixedPrincipal,
        isRepeat: isRepeat
    };

    if (isFixedPrincipal) {
        const principalPer = parseFloat(document.getElementById('principalPerPayment').value);
        const totalInterest = parseFloat(document.getElementById('totalInterest').value);
        const frequency = document.getElementById('fixedPrincipalFrequency').value;

        if (!principalPer || !totalInterest) {
            alert('Please fill in principal per payment and total interest');
            return;
        }

        const paymentCount = calculatePaymentCount(firstDate, lastDate, frequency);

        loan.principalPerPayment = principalPer;
        loan.totalInterest = totalInterest;
        loan.fixedPrincipalFrequency = frequency;
        loan.paymentCount = paymentCount;
    } else if (isRepeat) {
        const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
        const frequency = document.getElementById('paymentFrequency').value;

        if (!paymentAmount) {
            alert('Please fill in payment amount');
            return;
        }

        const paymentCount = calculatePaymentCount(firstDate, lastDate, frequency);

        loan.paymentAmount = paymentAmount;
        loan.paymentCount = paymentCount;
        loan.frequency = frequency;
    }

    if (editingLoanId) {
        const index = platforms[currentPlatform].loans.findIndex(l => l.id === editingLoanId);
        if (index !== -1) {
            platforms[currentPlatform].loans[index] = loan;
        }
    } else {
        platforms[currentPlatform].loans.push(loan);
    }

    clearLoanForm();
    savePlatforms();
    updateModalStats();
    renderLoans();
}

function deleteLoan(loanId) {
    if (confirm('Are you sure you want to delete this loan?')) {
        platforms[currentPlatform].loans = platforms[currentPlatform].loans.filter(l => l.id !== loanId);
        if (editingLoanId === loanId) {
            clearLoanForm();
        }
        savePlatforms();
        updateModalStats();
        renderLoans();
    }
}

function getFrequencyMultiplier(frequency) {
    const multipliers = {
        'daily': 30,
        'weekly': 4.33,
        'monthly': 1,
        'quarterly': 0.33,
        'yearly': 0.083
    };
    return multipliers[frequency] || 1;
}

function getLoanDurationInMonths(firstDate, lastDate) {
    const first = new Date(firstDate);
    const last = new Date(lastDate);
    return (last.getFullYear() - first.getFullYear()) * 12 +
        (last.getMonth() - first.getMonth()) + 1;
}

function calculatePlatformStats(platformName) {
    const loans = platforms[platformName].loans;
    const totalInvested = loans.reduce((sum, loan) => sum + loan.amount, 0);

    let monthlyIncome = 0;
    let monthlyInterest = 0;
    let totalReturn = 0;
    let totalInterestEarned = 0;
    let totalMonths = 0;

    loans.forEach(loan => {
        const durationInMonths = getLoanDurationInMonths(loan.firstPaymentDate, loan.lastPaymentDate);
        totalMonths += durationInMonths;

        if (loan.isFixedPrincipal) {
            const multiplier = getFrequencyMultiplier(loan.fixedPrincipalFrequency);
            monthlyIncome += loan.principalPerPayment * multiplier;
            monthlyInterest += 0;
            totalReturn += loan.amount + loan.totalInterest;
            totalInterestEarned += loan.totalInterest;
        } else if (loan.isBullet && loan.isRepeat) {
            const multiplier = getFrequencyMultiplier(loan.frequency);
            const interestPerMonth = loan.paymentAmount * multiplier;
            monthlyIncome += interestPerMonth;
            monthlyInterest += interestPerMonth;
            const totalInterest = loan.paymentAmount * loan.paymentCount;
            totalReturn += totalInterest + loan.amount;
            totalInterestEarned += totalInterest;
        } else if (loan.isRepeat) {
            const multiplier = getFrequencyMultiplier(loan.frequency);
            monthlyIncome += loan.paymentAmount * multiplier;
            const totalPaid = loan.paymentAmount * loan.paymentCount;
            const interestEarned = totalPaid - loan.amount;
            monthlyInterest += (interestEarned / loan.paymentCount) * multiplier;
            totalReturn += totalPaid;
            totalInterestEarned += interestEarned;
        } else {
            totalReturn += loan.amount;
        }
    });

    const profit = totalReturn - totalInvested;

    // Calculate Net Annualised Return
    const avgDurationInMonths = loans.length > 0 ? totalMonths / loans.length : 0;
    const avgDurationInYears = avgDurationInMonths / 12;
    const netAnnualisedReturn = (totalInvested > 0 && avgDurationInYears > 0)
        ? (totalInterestEarned / totalInvested / avgDurationInYears) * 100
        : 0;

    return {
        totalInvested,
        monthlyIncome,
        monthlyInterest,
        totalReturn,
        profit,
        netAnnualisedReturn,
        loanCount: loans.length,
        annualInterestRate: netAnnualisedReturn,
        totalInterestEarned
    };
}

function updateModalStats() {
    const stats = calculatePlatformStats(currentPlatform);
    document.getElementById('modalTotalInvested').textContent = formatCurrency(stats.totalInvested);
    document.getElementById('modalMonthlyIncome').textContent = formatCurrency(stats.monthlyIncome);
    document.getElementById('modalTotalReturn').textContent = formatCurrency(stats.totalInterestEarned);
    document.getElementById('modalROI').textContent = `${stats.netAnnualisedReturn.toFixed(2)}%`;
    document.getElementById('modalLoanCount').textContent = stats.loanCount;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderLoans() {
    const container = document.getElementById('loansContainer');
    const loans = platforms[currentPlatform].loans
        .filter(loan => loan.description.toLowerCase().includes(loanSearchTerm.toLowerCase()));

    if (loans.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No loans added yet</p>';
        return;
    }

    container.innerHTML = loans.map(loan => {
        let paymentInfo = '';
        let returnInfo = '';
        let roi = 0;
        let badge = '';
        const categoryBadge = `<span class="badge badge-${loan.category || 'other'}">${(loan.category || 'other').toUpperCase()}</span>`;

        if (loan.isFixedPrincipal) {
            const totalReturn = loan.amount + loan.totalInterest;
            const profit = loan.totalInterest;
            const durationInMonths = getLoanDurationInMonths(loan.firstPaymentDate, loan.lastPaymentDate);
            const durationInYears = durationInMonths / 12;
            roi = durationInYears > 0 ? ((profit / loan.amount / durationInYears) * 100).toFixed(2) : '0.00';
            const regularPayments = loan.paymentCount - 1;
            const regularPrincipal = loan.principalPerPayment * regularPayments;
            const remainingPrincipal = loan.amount - regularPrincipal;
            paymentInfo = `${regularPayments} × ${formatCurrency(loan.principalPerPayment)} (principal) + Final: ${formatCurrency(remainingPrincipal + loan.totalInterest)}`;
            returnInfo = `Total interest: ${formatCurrency(loan.totalInterest)} | Total return: ${formatCurrency(totalReturn)}`;
            badge = '<span class="badge badge-fixed-principal">FIXED PRINCIPAL</span>';
        } else if (loan.isBullet && loan.isRepeat) {
            const totalInterest = loan.paymentAmount * loan.paymentCount;
            const totalReturn = totalInterest + loan.amount;
            const profit = totalReturn - loan.amount;
            const durationInMonths = getLoanDurationInMonths(loan.firstPaymentDate, loan.lastPaymentDate);
            const durationInYears = durationInMonths / 12;
            roi = durationInYears > 0 ? ((profit / loan.amount / durationInYears) * 100).toFixed(2) : '0.00';
            paymentInfo = `Interest: ${loan.paymentCount} × ${formatCurrency(loan.paymentAmount)} ${loan.frequency}`;
            returnInfo = `Total interest: ${formatCurrency(totalInterest)} + Principal: ${formatCurrency(loan.amount)} = ${formatCurrency(totalReturn)}`;
            badge = '<span class="badge badge-bullet">BULLET</span>';
        } else if (loan.isRepeat) {
            const totalReturn = loan.paymentAmount * loan.paymentCount;
            const profit = totalReturn - loan.amount;
            const durationInMonths = getLoanDurationInMonths(loan.firstPaymentDate, loan.lastPaymentDate);
            const durationInYears = durationInMonths / 12;
            roi = durationInYears > 0 ? ((profit / loan.amount / durationInYears) * 100).toFixed(2) : '0.00';
            paymentInfo = `${loan.paymentCount} × ${formatCurrency(loan.paymentAmount)} ${loan.frequency}`;
            returnInfo = `Total return: ${formatCurrency(totalReturn)}`;
            badge = '<span class="badge badge-repeat">REPEAT</span>';
        } else {
            paymentInfo = 'Single payment';
            returnInfo = `Amount: ${formatCurrency(loan.amount)}`;
        }

        const isEditing = editingLoanId === loan.id;
        const editingStyle = isEditing ? 'style="border-left: 4px solid #2196F3; background: #e3f2fd;"' : '';

        return `
            <div class="loan-item" ${editingStyle}>
                <div class="loan-header">
                    <div>
                        <div class="loan-title">${loan.description}${categoryBadge}${badge}${isEditing ? ' <span class="edit-mode-badge">Editing</span>' : ''}</div>
                        <div class="loan-details">${formatCurrency(loan.amount)} invested</div>
                    </div>
                    <div class="loan-actions">
                        <button class="edit-loan" onclick="editLoan(${loan.id})">Edit</button>
                        <button class="delete-loan" onclick="deleteLoan(${loan.id})">Delete</button>
                    </div>
                </div>
                <div class="loan-details-row">
                    <div class="detail-item">
                        <span class="detail-label">Payment:</span> ${paymentInfo}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Return:</span> ${returnInfo}
                    </div>
                    ${(loan.isRepeat || loan.isBullet || loan.isFixedPrincipal) ? `<div class="detail-item"><span class="detail-label">Net Annualised Return:</span> ${roi}%</div>` : ''}
                    <div class="detail-item">
                        <span class="detail-label">First Payment:</span> ${formatDate(loan.firstPaymentDate)}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last Payment:</span> ${formatDate(loan.lastPaymentDate)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderPlatforms() {
    const grid = document.getElementById('platformsGrid');
    const noPlatforms = document.getElementById('noPlatforms');
    const platformNames = Object.keys(platforms)
        .filter(name => name.toLowerCase().includes(platformSearchTerm.toLowerCase()));

    if (platformNames.length === 0) {
        grid.style.display = 'none';
        noPlatforms.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    noPlatforms.style.display = 'none';

    grid.innerHTML = platformNames.map(name => {
        const stats = calculatePlatformStats(name);
        return `
            <div class="platform-box" onclick="openPlatform('${name}')">
                <button class="delete-platform" onclick="deletePlatform('${name}', event)">×</button>
                <h3>${name}</h3>
                <div class="platform-stats">
                    <div><strong>Invested:</strong> ${formatCurrency(stats.totalInvested)}</div>
                    <div><strong>Monthly:</strong> ${formatCurrency(stats.monthlyIncome)}</div>
                    <div><strong>Total Interest:</strong> ${formatCurrency(stats.totalInterestEarned)}</div>
                    <div><strong>Net Annualised Return:</strong> ${stats.netAnnualisedReturn.toFixed(2)}%</div>
                    <div><strong>Loans:</strong> ${stats.loanCount}</div>
                </div>
            </div>
        `;
    }).join('');
}

function updatePortfolioSummary() {
    const platformNames = Object.keys(platforms);
    let totalInvested = 0;
    let monthlyIncome = 0;
    let monthlyInterest = 0;
    let totalReturn = 0;
    let totalLoans = 0;
    let totalInterestEarned = 0;
    let totalMonths = 0;
    let totalLoanCount = 0;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    let earnedThisMonth = 0;
    let yieldThisYear = 0;
    let pendingIncomes = 0;

    platformNames.forEach(name => {
        const stats = calculatePlatformStats(name);
        totalInvested += stats.totalInvested;
        monthlyIncome += stats.monthlyIncome;
        monthlyInterest += stats.monthlyInterest;
        totalReturn += stats.totalReturn;
        totalLoans += stats.loanCount;

        platforms[name].loans.forEach(loan => {
            totalLoanCount++;
            const durationInMonths = getLoanDurationInMonths(loan.firstPaymentDate, loan.lastPaymentDate);
            totalMonths += durationInMonths;

            const firstPayment = new Date(loan.firstPaymentDate);
            const lastPayment = new Date(loan.lastPaymentDate);

            // Calculate earned this month
            if (firstPayment <= currentDate) {
                if (loan.isFixedPrincipal) {
                    const multiplier = getFrequencyMultiplier(loan.fixedPrincipalFrequency);
                    const monthlyPrincipal = loan.principalPerPayment * multiplier;
                    if (lastPayment.getMonth() === currentMonth && lastPayment.getFullYear() === currentYear) {
                        earnedThisMonth += monthlyPrincipal + loan.totalInterest;
                    } else if (lastPayment >= currentDate) {
                        earnedThisMonth += monthlyPrincipal;
                    }
                } else if (loan.isBullet && loan.isRepeat) {
                    const multiplier = getFrequencyMultiplier(loan.frequency);
                    const monthlyPayment = loan.paymentAmount * multiplier;
                    if (lastPayment >= currentDate) {
                        earnedThisMonth += monthlyPayment;
                    }
                } else if (loan.isRepeat) {
                    const multiplier = getFrequencyMultiplier(loan.frequency);
                    const monthlyPayment = loan.paymentAmount * multiplier;
                    if (lastPayment >= currentDate) {
                        earnedThisMonth += monthlyPayment;
                    }
                }
            }

            // Calculate yield this year (total interest earned in current year)
            if (loan.isFixedPrincipal) {
                if (firstPayment.getFullYear() <= currentYear && lastPayment.getFullYear() >= currentYear) {
                    const yearStart = new Date(currentYear, 0, 1);
                    const yearEnd = new Date(currentYear, 11, 31);
                    const effectiveStart = firstPayment > yearStart ? firstPayment : yearStart;
                    const effectiveEnd = lastPayment < yearEnd ? lastPayment : yearEnd;

                    if (effectiveStart <= effectiveEnd) {
                        const monthsInYear = getLoanDurationInMonths(
                            effectiveStart.toISOString().split('T')[0],
                            effectiveEnd.toISOString().split('T')[0]
                        );
                        const multiplier = getFrequencyMultiplier(loan.fixedPrincipalFrequency);
                        const monthlyPrincipal = loan.principalPerPayment * multiplier;

                        if (lastPayment.getFullYear() === currentYear) {
                            yieldThisYear += loan.totalInterest;
                        }
                    }
                }
                totalInterestEarned += loan.totalInterest;
            } else if (loan.isBullet && loan.isRepeat) {
                const totalInterest = loan.paymentAmount * loan.paymentCount;
                if (firstPayment.getFullYear() <= currentYear && lastPayment.getFullYear() >= currentYear) {
                    const yearStart = new Date(currentYear, 0, 1);
                    const yearEnd = new Date(currentYear, 11, 31);
                    const effectiveStart = firstPayment > yearStart ? firstPayment : yearStart;
                    const effectiveEnd = lastPayment < yearEnd ? lastPayment : yearEnd;

                    if (effectiveStart <= effectiveEnd) {
                        const monthsInYear = getLoanDurationInMonths(
                            effectiveStart.toISOString().split('T')[0],
                            effectiveEnd.toISOString().split('T')[0]
                        );
                        const multiplier = getFrequencyMultiplier(loan.frequency);
                        yieldThisYear += loan.paymentAmount * multiplier * monthsInYear;
                    }
                }
                totalInterestEarned += totalInterest;
            } else if (loan.isRepeat) {
                const totalPaid = loan.paymentAmount * loan.paymentCount;
                const interestEarned = totalPaid - loan.amount;

                if (firstPayment.getFullYear() <= currentYear && lastPayment.getFullYear() >= currentYear) {
                    const yearStart = new Date(currentYear, 0, 1);
                    const yearEnd = new Date(currentYear, 11, 31);
                    const effectiveStart = firstPayment > yearStart ? firstPayment : yearStart;
                    const effectiveEnd = lastPayment < yearEnd ? lastPayment : yearEnd;

                    if (effectiveStart <= effectiveEnd) {
                        const monthsInYear = getLoanDurationInMonths(
                            effectiveStart.toISOString().split('T')[0],
                            effectiveEnd.toISOString().split('T')[0]
                        );
                        const totalMonthsInLoan = getLoanDurationInMonths(loan.firstPaymentDate, loan.lastPaymentDate);
                        const interestPerMonth = interestEarned / totalMonthsInLoan;
                        yieldThisYear += interestPerMonth * monthsInYear;
                    }
                }
                totalInterestEarned += interestEarned;
            }

            // Calculate pending incomes (future payments)
            if (lastPayment > currentDate) {
                if (loan.isFixedPrincipal) {
                    const regularPayments = loan.paymentCount - 1;
                    const regularPrincipal = loan.principalPerPayment * regularPayments;
                    const remainingPrincipal = loan.amount - regularPrincipal;
                    pendingIncomes += remainingPrincipal + loan.totalInterest;
                } else if (loan.isBullet && loan.isRepeat) {
                    const paymentsLeft = calculatePaymentCount(
                        currentDate.toISOString().split('T')[0],
                        loan.lastPaymentDate,
                        loan.frequency
                    );
                    pendingIncomes += (loan.paymentAmount * paymentsLeft) + loan.amount;
                } else if (loan.isRepeat) {
                    const paymentsLeft = calculatePaymentCount(
                        currentDate.toISOString().split('T')[0],
                        loan.lastPaymentDate,
                        loan.frequency
                    );
                    pendingIncomes += loan.paymentAmount * paymentsLeft;
                } else {
                    pendingIncomes += loan.amount;
                }
            }
        });
    });

    document.getElementById('totalInvested').textContent = formatCurrency(totalInvested);
    document.getElementById('earnedThisMonth').textContent = formatCurrency(earnedThisMonth);
    document.getElementById('yieldThisYear').textContent = formatCurrency(yieldThisYear);
    document.getElementById('pendingIncomes').textContent = formatCurrency(pendingIncomes);
    document.getElementById('platformSearch').addEventListener('input', function (e) {
        platformSearchTerm = e.target.value;
        renderPlatforms();
    });

    document.getElementById('loanSearch').addEventListener('input', function (e) {
        loanSearchTerm = e.target.value;
        renderLoans();
    });

    // Calculate and display average yield
    const averageYield = (totalInvested > 0)
        ? (totalInterestEarned / totalInvested * 100)
        : 0;
    document.getElementById('averageYield').textContent = `${averageYield.toFixed(2)}%`;
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function () {
    loadTheme();
    document.getElementById('currencySelector').value = currentCurrency;
    setInterval(checkPaymentDues, 60000); // Check every minute
    checkPaymentDues(); // Initial check
    renderPlatforms();
    updatePortfolioSummary();
    setTimeout(initializeCharts, 100);
});

document.getElementById('dismissAllPayments').addEventListener('click', function () {
    document.getElementById('paymentAlerts').innerHTML = '';
    this.style.display = 'none';
});


// Modal close on outside click
window.onclick = function (event) {
    const modal = document.getElementById('loanModal');
    if (event.target === modal) {
        closeModal();
    }
}
