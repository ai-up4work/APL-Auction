import { AuctionConfig } from '@/types/sankeytype';

export const AUCTION_CONFIG = {
    players: [
        { id: 'p1', name: 'Marcus Vane', status: 'sold', price: '$2.4M', teamShortCode: 'KKR', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHA2u7p1Bsfc-isQBuMY6Tyy5w-w1VgmqlnqcgdmAPYUjT6X1Ya49i7v2J8E86APuRCQIJbgT2QU3FlZRMjumI3f7GnriJT8ArIahOfawvkDdY4tO01-ql0v6yKKpGWgjrprreCFw6qzHppBE3EGE_wcIK14EZtYv5KoxZ5H78uIYWDpREvheAcN2ucbF-2Uhtl1QPXsHbbxYHt9_2sFNABMg2p945DX94NqNQYQfMkiuwARZHDIoOa_B1UkS_aS_9hU0TbmQst3A' },
        { id: 'p2', name: 'Dominic Vance', status: 'sold', price: '$4.25M', teamShortCode: 'MI', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHv-1L_r_F-Isc6mR95V108179Vscv04M-o0xK1tOcl94jO5o_lM-f3hR2E_V8FvN7i2lZf4oN' },
        { id: 'p3', name: 'Elena Rodas', status: 'sold', price: '$800K', teamShortCode: 'CSK', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5QO0_cfCKHnCSLR-M3fIlDAFZhUJ6YRfY-cG4gmBHFv8CC0nodbztLSNZdk2pIYBN60b0bNXikNJH3Ltq5MRiK4VOyM6bUeaMulbBzm1hVahn7mbJi34EIzmYSCa9ucowGmSWZIaG89liytiIxFmSQdS9d-Y4ZvWYxM1C-VzVQvxclDiizpTiFC--WVV06Tl-wbW25wPZen-aKDLKt5KP1Y9M5d8nLZMkXJ9Q1BE01Q04BD4HvTCDvQfk4cQZ9OeNL2KifkGKvLQ' },
        { id: 'p4', name: 'S. T. Arnett', status: 'sold', price: '$1.2M', teamShortCode: 'MI', img: null },
        { id: 'p5', name: 'Jaxon Kade', status: 'sold', price: '$1.5M', teamShortCode: 'RCB', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCvzTjBz7LFJnecQxXb5VfZRsOz7z5gwO4iomOt5DklmbpHmqbOHWE0171jAhCrrQdCXK4l6_QP2kTrOLA1n58Bw6uBYf8Gu2pmepXv_LFPf_raW8hswgWNRArqwdbHT53zZAC25_AfdKISpalv1DAHyU46z0_AA7ig7I5TMGsOTnHuUfuqmLdoQvxSMeAVPL7o--OTnWUUcNQ8zo9U38-zbSc6-3n_wjNJRY8udmY_pfAsgKaRjyjW5Ty0axX7IqRpBhbjaz2nK2A' },
        { id: 'p6', name: 'Li Wei', status: 'sold', price: '$0.9M', teamShortCode: 'CSK', img: null },
        { id: 'p7', name: 'Rohan Sharma', status: 'sold', price: '$3.1M', teamShortCode: 'RCB', img: null },
        { id: 'p8', name: 'Alex Frost', status: 'pending', price: '$600K', teamShortCode: null, img: null },
        { id: 'p9', name: 'Sarah Miller', status: 'pending', price: '$2.2M', teamShortCode: null, img: null },
        { id: 'p10', name: 'David Okafor', status: 'pending', price: '$1.8M', teamShortCode: null, img: null },
        { id: 'p11', name: 'Carlos Diaz', status: 'locked', price: '$1.1M', teamShortCode: null, img: null },
        { id: 'p12', name: 'Yuki Sato', status: 'locked', price: '$2.7M', teamShortCode: null, img: null },
        { id: 'p13', name: 'Michael Chen', status: 'locked', price: '$1.0M', teamShortCode: null, img: null },
        { id: 'p14', name: 'Oliver Twist', status: 'locked', price: '$1.4M', teamShortCode: null, img: null },
        { id: 'p15', name: 'Jack Reacher', status: 'locked', price: '$3.2M', teamShortCode: null, img: null },
        { id: 'p16', name: 'John Doe', status: 'locked', price: '$0.5M', teamShortCode: null, img: null },
        { id: 'p17', name: 'Sam Smith', status: 'locked', price: '$1.9M', teamShortCode: null, img: null },
        { id: 'p18', name: 'Chris Evans', status: 'locked', price: '$2.5M', teamShortCode: null, img: null },
        { id: 'p19', name: 'Tom Holland', status: 'locked', price: '$1.3M', teamShortCode: null, img: null },
        { id: 'p20', name: 'Mark Ruffalo', status: 'locked', price: '$2.1M', teamShortCode: null, img: null }
    ],
    teams: [
        { id: 't1', shortCode: 'CSK', name: 'Chennai Super Kings', purse: '$14.2M', logoUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLtpOUHFaBFbzm7NiCoAQ5dOgw7w-XDnq8V4QoTkJazDFefJbFVZ6nwo0yVQWZVVt6w0wyadxZTSPlXAW3o3SE0IGHYdncO6VN6SKBSziSK61maXEMtxQGBGBeDsHJJT-YU2XxKKRL9ikXLsg5uAJpmVYuOjjoh_yBfW-M7OBCj4Ddn8Re5-lul1pDfW-k2zgOuOXGHBX3rumVnM0zLCcSVrCLnsoCxk6FhIAZi0eCkVCE3msllDlrNgzpo' },
        { id: 't2', shortCode: 'RCB', name: 'RC Bangalore', purse: '$8.9M', logoUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLuwpBaoEy5gvAbpY4ke5N8kMFQ4pK6DXr-JS-fkpw_dys3Ig3stkRKphCqCXOjn0927lVdUFd_1hDxv1AYf8eYJ7ofKDSH3GlBXTaShiSihgA1RIgGM8UIuRqdYyMHLBHAQ3vymF-llMfuzfBKDiIuz6uwHa3MDmmILkztCtu-si1W11wcIBZRU18Ty8fQmvTV2n5q48uftGDTGNewTHBq2drx-8sg3s8KpdE9A2Y0isnq2jidukTH0ykA' },
        { id: 't3', shortCode: 'MI', name: 'Mumbai Indians', purse: '$21.5M', logoUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLvNrK1fmiCMPEJItgVwxV1QbLjKCbvEaLi693ZJH9ketOGPxjs20MQTLpGsr8ONP1LIYS_SJID12LnJHAgbrLk822ZuTXAbZJWUBXyUKmmLgVPRfHXlI1GEbaXMdl25Fb3zDDssuzFz0Ncs80Ul_E3oh_GQuhrbEx-NX_Zxwkuo-kLv53gMZeK1527M4lM5JC9fEi8e20CkpkgeE_6-zaRyNx6EU22vzcUMSBg_XS7SSlDwC4h2We8OQg' },
        { id: 't4', shortCode: 'KKR', name: 'Kolkata Knight Riders', purse: '$5.2M', logoUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLvStyFXqwVpWoqVFbNq2uokGGC1QrbT95ADlTFtRvq9of6fkD3gypAReFhghEULhn2FFTnGp6ANrImoOD14JeR0ILqvVS3mm4FwJRYUpb4TSZPF5De0a__QKKm-vqON-EvkJ7VG-lr6hQ7tro3dR0I31X9gAm4qqdJ6zXyZPssiSjpsqFa8JH177JQ_eQ7YBGl67Axg30tPoVBbhzeYUYioDuwGg-aIxaB30Gik-jTvR6XhJqU_8913t9Q' },
        { id: 't5', shortCode: 'DC', name: 'Delhi Capitals', purse: '$11.4M', logoUrl: null },
        // { id: 't6', shortCode: 'RR', name: 'Rajasthan Royals', purse: '$16.8M', logoUrl: null },
        // { id: 't7', shortCode: 'LSG', name: 'Lucknow Super Giants', purse: '$12.0M', logoUrl: null },
        // { id: 't8', shortCode: 'GT', name: 'Gujarat Titans', purse: '$19.3M', logoUrl: null }
    ]
} as unknown as AuctionConfig;
