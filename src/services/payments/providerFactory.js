const SUPPORTED_PROVIDERS = ['stripe', 'mercadopago', 'paypal'];

class PaymentProviderNotConfiguredError extends Error {
  constructor() {
    super('No hay proveedor de pago configurado');
    this.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    this.status = 503;
  }
}

class UnsupportedPaymentProviderError extends Error {
  constructor(provider) {
    super(`Proveedor de pago no soportado: ${provider}`);
    this.code = 'UNSUPPORTED_PAYMENT_PROVIDER';
    this.status = 400;
  }
}

class PaymentProviderNotImplementedError extends Error {
  constructor(provider) {
    super(`Proveedor ${provider} aun no integrado`);
    this.code = 'PAYMENT_PROVIDER_NOT_IMPLEMENTED';
    this.status = 503;
  }
}

const normalizeProvider = (provider) => {
  if (!provider || typeof provider !== 'string') return null;
  const normalized = provider.trim().toLowerCase();
  return normalized || null;
};

const getConfiguredProvider = () => normalizeProvider(process.env.PAYMENT_PROVIDER);

const createProviderAdapter = (providerName) => {
  const provider = normalizeProvider(providerName) || getConfiguredProvider();

  if (!provider) {
    throw new PaymentProviderNotConfiguredError();
  }

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new UnsupportedPaymentProviderError(provider);
  }

  return {
    name: provider,
    async createPaymentIntent() {
      throw new PaymentProviderNotImplementedError(provider);
    },
    async verifyWebhookSignature() {
      throw new PaymentProviderNotImplementedError(provider);
    },
    async mapWebhookEvent() {
      throw new PaymentProviderNotImplementedError(provider);
    }
  };
};

module.exports = {
  SUPPORTED_PROVIDERS,
  getConfiguredProvider,
  createProviderAdapter,
  PaymentProviderNotConfiguredError,
  UnsupportedPaymentProviderError,
  PaymentProviderNotImplementedError
};
