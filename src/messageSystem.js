export class MessageSystem {
    constructor() {
        this.messages = [];
        this.container = null;
        this.messageLifetime = 7000;
        this.fadeOutDuration = 1000;
        this.init();
    }

    init() {
        this.container = document.getElementById('message-container')
    }

    addMessage(text, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.className = `game-message message-${type}`;
        messageElement.textContent = text;

        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(-10px)';

        this.container.insertBefore(messageElement, this.container.firstChild);

        requestAnimationFrame(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        });

        const message = {
            element: messageElement,
            timestamp: Date.now(),
            fadeStarted: false,
        };

        this.messages.push(message);

        setTimeout(() => {
            this.startFadeOut(message);
        }, this.messageLifetime - this.fadeOutDuration);
    }

    startFadeOut(message) {
        if (message.fadeStarted) return;
        message.fadeStarted = true;

        message.element.style.opacity = '0';

        setTimeout(() => {
            this.removeMessage(message);
        }, this.fadeOutDuration);
    }

    removeMessage(message) {
        const index = this.messages.indexOf(message);
        if (index > -1) {
            this.messages.splice(index, 1);
            if (message.element.parentNode) {
                message.element.remove();
            }
        }
    }

    clear() {
        this.messages.forEach(message => {
            if (message.element.parentNode) {
                message.element.remove();
            }
        });
        this.messages = [];
    }
}
