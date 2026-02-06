global.chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn()
    },
    sidePanel: {
        setPanelBehavior: jest.fn(),
        open: jest.fn()
    }
};
