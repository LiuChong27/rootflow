module.exports = {
  wechatMiniProgram: {
    appId: 'wx3557eefe54fc9971',
    appSecret: '2419f05e600251e986def726d07f3ef9',
  },
  downloads: {
    paymentMode: 'free',
    iosPurchaseEnabled: false,
    ticketExpireSeconds: 900,
    cloudStorageDir: 'rootflow/pdfs/v1',
    purchaseUnavailableReason: '',
    products: {
      rf_lifetime_member_990: {
        title: '永久会员',
        amountFen: 990,
      },
      rf_pdf_30_pack_200: {
        title: '30 次 PDF 下载次数',
        amountFen: 200,
        creditDelta: 30,
      },
    },
  },
};
