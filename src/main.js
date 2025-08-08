console.log('Hello from Vite!');

// Add some basic styling
document.body.style.fontFamily = 'system-ui, sans-serif';
document.body.style.margin = '0';
document.body.style.padding = '2rem';
document.body.style.backgroundColor = '#f5f5f5';

const app = document.querySelector('#app');
if (app) {
    app.style.maxWidth = '600px';
    app.style.margin = '0 auto';
    app.style.textAlign = 'center';
    app.style.backgroundColor = 'white';
    app.style.padding = '2rem';
    app.style.borderRadius = '8px';
    app.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
}