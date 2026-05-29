import { useState } from 'react';
import { createRecord } from '../services/airtable.js';
import { PORTFOLIO_TABLE } from '../config/tables.js';
import { PEOPLE } from '../config/constants.js';

// Baked-in from Airtable — avoids a fetch on form load
const PRODUCTS = [
  { id: 'recnxBW7eVc4CtQ2Y', name: 'AA Red', fee: 99, bank: 'Barclays', rpId: 'rec55IJ1WaYQmpeu8' },
  { id: 'rechmgMCYxoRkY5Om', name: 'AAdvantage Business Card', fee: 99, bank: 'Citi', rpId: 'rec55IJ1WaYQmpeu8' },
  { id: 'rec1DsnGwWXeypPiI', name: 'AAdvantage Executive Card', fee: 595, bank: 'Citi', rpId: 'rec55IJ1WaYQmpeu8' },
  { id: 'reczcwvCDEUGLKkxx', name: 'AAdvantage Globe Card', fee: 350, bank: 'Citi', rpId: 'rec55IJ1WaYQmpeu8' },
  { id: 'rec0rSBC6c20j2XSY', name: 'AAdvantage Mile Up Card', fee: 0, bank: 'Citi', rpId: 'rec55IJ1WaYQmpeu8' },
  { id: 'recBZ1QCLxfnFrpsO', name: 'AAdvantage Platinum Select', fee: 99, bank: 'Citi', rpId: 'rec55IJ1WaYQmpeu8' },
  { id: 'rectLpaEVePqAsMzT', name: 'Aer Lingus Card', fee: 95, bank: 'Chase', rpId: 'rec76U3fn4IPPgJEX' },
  { id: 'rec2h4Dbzttky2FxR', name: 'Aeroplan Card', fee: 95, bank: 'Chase', rpId: 'recVYmtytrNTEuNs8' },
  { id: 'rec68g2J1nx242idu', name: 'Air France/KLM Card', fee: 89, bank: 'Bank of America', rpId: 'recj0D9sIyA6xLrDK' },
  { id: 'recJjUDd9iZPjib8W', name: 'Altitude Connect Card', fee: 0, bank: 'U.S. Bank', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recogOrJfY7NsoI7c', name: 'Altitude Go Card', fee: 0, bank: 'U.S. Bank', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recyzPOvmEoawdye5', name: 'Altitude Reserve Card', fee: 400, bank: 'U.S. Bank', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recarklxP7aJp0fZl', name: 'Amex Business Gold', fee: 375, bank: 'American Express', rpId: 'recoRV4OeBwFuxgAC' },
  { id: 'recP0Fkz9HZsLAaBI', name: 'Amex Business Green', fee: 95, bank: 'American Express', rpId: 'recoRV4OeBwFuxgAC' },
  { id: 'rec2x86ypeE8g9RtY', name: 'Amex Business Platinum', fee: 895, bank: 'American Express', rpId: 'recoRV4OeBwFuxgAC' },
  { id: 'recFC4YKM7TYDn2oq', name: 'Amex Gold', fee: 325, bank: 'American Express', rpId: 'recoRV4OeBwFuxgAC' },
  { id: 'receZOXZeDUtGeoJS', name: 'Amex Green', fee: 150, bank: 'American Express', rpId: 'recoRV4OeBwFuxgAC' },
  { id: 'recNcffVXplx0wr2X', name: 'Amex Platinum', fee: 895, bank: 'American Express', rpId: 'recoRV4OeBwFuxgAC' },
  { id: 'recQb3rU8mSrNV3l3', name: 'Atmos Ascent Card', fee: 95, bank: 'Bank of America', rpId: 'recKOeD2LeTE2umQ2' },
  { id: 'recUMNurkZLbXxBtL', name: 'Atmos Business Card', fee: 95, bank: 'Bank of America', rpId: 'recKOeD2LeTE2umQ2' },
  { id: 'recxMv4Ip4LOsChlk', name: 'Atmos Summit Card', fee: 395, bank: 'Bank of America', rpId: 'recKOeD2LeTE2umQ2' },
  { id: 'recynJvlC4isNG9CS', name: 'Autograph Card', fee: 0, bank: 'Wells Fargo', rpId: 'recNtJU89S1XzM2oi' },
  { id: 'recUmBqJLn2dVTsrJ', name: 'Autograph Journey Card', fee: 95, bank: 'Wells Fargo', rpId: 'recNtJU89S1XzM2oi' },
  { id: 'rec9SVlC07lHEtdKd', name: 'Bank of America Customized Cash Rewards', fee: 0, bank: 'Bank of America', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'rec5Z4D40ABESaS0g', name: 'Bank of America Premium Rewards', fee: 95, bank: 'Bank of America', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recmUKR6jTRoA5I4h', name: 'Bank of America Premium Rewards Elite', fee: 550, bank: 'Bank of America', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recVPx81NIKrYrPdn', name: 'Bank of America Travel Rewards', fee: 0, bank: 'Bank of America', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'reckawZ1L94DF3tPF', name: 'Bank of America Unlimited Cash Rewards', fee: 0, bank: 'Bank of America', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recdh7Rmh5GUmPvn3', name: 'Best Western Card', fee: 89, bank: 'Mercury', rpId: 'recQBrBYWXeCoUDDR' },
  { id: 'rec7QwlahhDIBhuWZ', name: 'Bilt Blue Card', fee: 0, bank: 'Cardless', rpId: 'recpgINanUGsm06PB' },
  { id: 'recN6VeeDWHXgjKbE', name: 'Bilt Odsidian Card', fee: 95, bank: 'Cardless', rpId: 'recpgINanUGsm06PB' },
  { id: 'recns9ZiVvGgXIQXz', name: 'Bilt Palladium Card', fee: 495, bank: 'Cardless', rpId: 'recpgINanUGsm06PB' },
  { id: 'recg82ZL6tATjga0S', name: 'Blue Business Plus', fee: 0, bank: 'American Express', rpId: 'recoRV4OeBwFuxgAC' },
  { id: 'recbC3jxkmmqYAXoZ', name: 'BOA Travel Rewards Business', fee: 0, bank: 'Bank of America', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recqOoxQrLL9ymFdr', name: 'Bonvoy', fee: 0, bank: 'American Express', rpId: 'recCrkqmUVPxcvoSR' },
  { id: 'recwb0QUMnhiPf3Yl', name: 'Bonvoy Bevy', fee: 250, bank: 'American Express', rpId: 'recCrkqmUVPxcvoSR' },
  { id: 'rec9qkZ6fkmAtHqv8', name: 'Bonvoy Brilliant', fee: 650, bank: 'American Express', rpId: 'recCrkqmUVPxcvoSR' },
  { id: 'recWzxsrYLZKXsI5I', name: 'Bonvoy Business', fee: 125, bank: 'American Express', rpId: 'recCrkqmUVPxcvoSR' },
  { id: 'recZ5tK0dIUYnPeFx', name: 'British Airways Card', fee: 95, bank: 'Chase', rpId: 'rec76U3fn4IPPgJEX' },
  { id: 'rec7RM1MtPRiEswdK', name: 'Business Advantage Unlimited Card', fee: 0, bank: 'Bank of America', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recZAIvyd6KiANA2Z', name: 'Business Altitude Connect Card', fee: 95, bank: 'U.S. Bank', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recmknd2TO85NgjIU', name: 'Business Altitude Power Card', fee: 195, bank: 'U.S. Bank', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recEmlTTaXRB6PUEt', name: 'Business Leverage Card', fee: 95, bank: 'U.S. Bank', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recIvHgSaPXS7RkUp', name: 'Chase Freedom (Legacy)', fee: 0, bank: 'Chase', rpId: 'reckXeIUYBdb6t1mi' },
  { id: 'recooimoqT4NgnEUr', name: 'Chase Freedom Flex', fee: 0, bank: 'Chase', rpId: 'reckXeIUYBdb6t1mi' },
  { id: 'recTPPFBiVazBFQFp', name: 'Chase Freedom Unlimited', fee: 0, bank: 'Chase', rpId: 'reckXeIUYBdb6t1mi' },
  { id: 'recydhNjtNPSdJBM3', name: 'Chase Sapphire Business', fee: 795, bank: 'Chase', rpId: 'reckXeIUYBdb6t1mi' },
  { id: 'recgtMKAR7T9n2QFO', name: 'Chase Sapphire Preferred', fee: 95, bank: 'Chase', rpId: 'reckXeIUYBdb6t1mi' },
  { id: 'recW0ZNmsK6apxq0a', name: 'Chase Sapphire Reserve', fee: 795, bank: 'Chase', rpId: 'reckXeIUYBdb6t1mi' },
  { id: 'recLyySLtkHcXFNXa', name: 'Choice Privileges Card', fee: 0, bank: 'Wells Fargo', rpId: 'recgZCguJJSeTkS3T' },
  { id: 'recUh67VZYOXMdjd9', name: 'Choice Privileges Select Card', fee: 95, bank: 'Wells Fargo', rpId: 'recgZCguJJSeTkS3T' },
  { id: 'rec6cv5Qr5qYwe6Mw', name: 'Custom Cash Card', fee: 0, bank: 'Citi', rpId: 'recxHZ1Zyd6EHgkcd' },
  { id: 'recS2cGSHe11BkzRc', name: 'Discover Card', fee: 0, bank: 'Discover', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recB9AAD2EXLSdFgA', name: 'Double Cash Card', fee: 0, bank: 'Citi', rpId: 'recxHZ1Zyd6EHgkcd' },
  { id: 'recxaRF3OYuU7AhU8', name: 'Hilton Aspire', fee: 550, bank: 'American Express', rpId: 'recSKJfk2KVcCqRKG' },
  { id: 'recCfU3PGyv0xeRDg', name: 'Hilton Business', fee: 195, bank: 'American Express', rpId: 'recSKJfk2KVcCqRKG' },
  { id: 'recOxMypidnrPk7wk', name: 'Hilton Free', fee: 0, bank: 'American Express', rpId: 'recSKJfk2KVcCqRKG' },
  { id: 'rec7VXIrrlT2LEdiq', name: 'Hilton Surpass', fee: 150, bank: 'American Express', rpId: 'recSKJfk2KVcCqRKG' },
  { id: 'rec8NZbaS9uBSCajh', name: 'Hyatt Business Card', fee: 199, bank: 'Chase', rpId: 'reclzb13sunBKONLc' },
  { id: 'reclzMh4kvNNI7ZM6', name: 'Iberia Card', fee: 95, bank: 'Chase', rpId: 'rec76U3fn4IPPgJEX' },
  { id: 'recPpVtBoy3E7QRmp', name: 'IHG Premier Business', fee: 99, bank: 'Chase', rpId: 'rec5Ey6PfbSqs09WW' },
  { id: 'rectaurhW2VSUo7Ox', name: 'IHG Premier Card', fee: 99, bank: 'Chase', rpId: 'rec5Ey6PfbSqs09WW' },
  { id: 'recvFGw0L79WdKjVh', name: 'IHG Traveler', fee: 0, bank: 'Chase', rpId: 'rec5Ey6PfbSqs09WW' },
  { id: 'reccOQNsLH1rco8gi', name: 'Ink Business Cash', fee: 0, bank: 'Chase', rpId: 'reckXeIUYBdb6t1mi' },
  { id: 'recKaKSPSzhIDVbx6', name: 'Ink Business Preferred', fee: 95, bank: 'Chase', rpId: 'reckXeIUYBdb6t1mi' },
  { id: 'recIOH0r0opsMEGwz', name: 'Ink Business Premier', fee: 195, bank: 'Chase', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'rec78MKDDWWET4Nnr', name: 'Ink Business Unlimited', fee: 0, bank: 'Chase', rpId: 'reckXeIUYBdb6t1mi' },
  { id: 'recRsomfYxu0XVqnp', name: 'JetBlue Business Card', fee: 99, bank: 'Barclays', rpId: 'rec639FwT4wR3st0K' },
  { id: 'rech6SLp0cckwtx1h', name: 'JetBlue Card', fee: 0, bank: 'Barclays', rpId: 'rec639FwT4wR3st0K' },
  { id: 'recyWrFLOvH5Ps63d', name: 'JetBlue Plus Card', fee: 99, bank: 'Barclays', rpId: 'rec639FwT4wR3st0K' },
  { id: 'recGiMfq5OU0elSqG', name: 'JetBlue Premier Card', fee: 499, bank: 'Barclays', rpId: 'rec639FwT4wR3st0K' },
  { id: 'recmh94PmYNphPof5', name: 'Lifemiles Card', fee: 99, bank: 'Cardless', rpId: 'recpF7WLSm4xCJ8Sm' },
  { id: 'recc5VJTCmdo4to4E', name: 'Lifemiles Elite Card', fee: 249, bank: 'Cardless', rpId: 'recpF7WLSm4xCJ8Sm' },
  { id: 'recav4ohWqXaU4C0q', name: 'Marriott Bonvoy Bold', fee: 0, bank: 'Chase', rpId: 'recCrkqmUVPxcvoSR' },
  { id: 'rec2V88hGAUvzz4iS', name: 'Marriott Bonvoy Boundless', fee: 95, bank: 'Chase', rpId: 'recCrkqmUVPxcvoSR' },
  { id: 'recvq7kWq6cjcwBST', name: 'Marriott Bonvoy Bountiful', fee: 250, bank: 'Chase', rpId: 'recCrkqmUVPxcvoSR' },
  { id: 'recDBIXjAjQbXF6Bo', name: 'Savor Cash Card', fee: 0, bank: 'Capital One', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recKT6aYDKKMfYasM', name: 'SavorOne Card', fee: 39, bank: 'Capital One', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recOG8NM8urHvalRB', name: 'Signify Business Cash', fee: 0, bank: 'Wells Fargo', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recaTHRjpFpjmKctc', name: 'Southwest Performance Business', fee: 299, bank: 'Chase', rpId: 'recwN2LICpUqtRyWP' },
  { id: 'recf98sHtWYO3srcR', name: 'Southwest Premier', fee: 149, bank: 'Chase', rpId: 'recwN2LICpUqtRyWP' },
  { id: 'recIB8WdVC2IIohJl', name: 'Southwest Premier Business', fee: 149, bank: 'Chase', rpId: 'recwN2LICpUqtRyWP' },
  { id: 'recnqdUPyIjp979SG', name: 'Southwest Priority', fee: 229, bank: 'Chase', rpId: 'recwN2LICpUqtRyWP' },
  { id: 'rec8YEAkt5bI7C7QD', name: 'Southwest Rewards Plus', fee: 99, bank: 'Chase', rpId: 'recwN2LICpUqtRyWP' },
  { id: 'recvr78qCLigELkM1', name: 'Spark Cash Card', fee: 95, bank: 'Capital One', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'rec0TCfJBgQybsSa7', name: 'Spark Cash Plus Card', fee: 150, bank: 'Capital One', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'reckbjNKctZ2rhG7d', name: 'Spark Cash Select', fee: 0, bank: 'Capital One', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recn8OpGL942xLc4I', name: 'Spark Miles', fee: 95, bank: 'Capital One', rpId: 'recL2Huh7e9Uh14o4' },
  { id: 'recT7PURf6Kkxb77l', name: 'Spark Miles Select', fee: 0, bank: 'Capital One', rpId: 'recL2Huh7e9Uh14o4' },
  { id: 'rec6R932NEC5UidoW', name: 'Strata Card', fee: 0, bank: 'Citi', rpId: 'recxHZ1Zyd6EHgkcd' },
  { id: 'recJJ0y02Z8Iv4iNm', name: 'Strata Elite Card', fee: 595, bank: 'Citi', rpId: 'recxHZ1Zyd6EHgkcd' },
  { id: 'reca0WvpGGg0NkzTP', name: 'Strata Premier Card', fee: 95, bank: 'Citi', rpId: 'recxHZ1Zyd6EHgkcd' },
  { id: 'recYVeDhyt0czqfth', name: 'Triple Cash Business Card', fee: 0, bank: 'U.S. Bank', rpId: 'recsJ9CLOzTWRVRNm' },
  { id: 'recz8Omf2ntlgeWJK', name: 'United Business Card', fee: 150, bank: 'Chase', rpId: 'recdOXsN7ckt3EZF0' },
  { id: 'recS4wzyRDPTSLrSS', name: 'United Club Business Card', fee: 695, bank: 'Chase', rpId: 'recdOXsN7ckt3EZF0' },
  { id: 'recEd29vRnHmrQlt5', name: 'United Club Card', fee: 695, bank: 'Chase', rpId: 'recdOXsN7ckt3EZF0' },
  { id: 'rec5IW6nSAqjro4Nm', name: 'United Explorer Card', fee: 150, bank: 'Chase', rpId: 'recdOXsN7ckt3EZF0' },
  { id: 'recDQBbMhjYWaAcvK', name: 'United Gateway Card', fee: 0, bank: 'Chase', rpId: 'recdOXsN7ckt3EZF0' },
  { id: 'reczEggdDbqYR12yt', name: 'United Quest Card', fee: 350, bank: 'Chase', rpId: 'recdOXsN7ckt3EZF0' },
  { id: 'recX92iE2zH9OyLhx', name: 'Venture Card', fee: 95, bank: 'Capital One', rpId: 'recL2Huh7e9Uh14o4' },
  { id: 'reclIv2w9Csi6b8Ap', name: 'Venture X Business Card', fee: 395, bank: 'Capital One', rpId: 'recL2Huh7e9Uh14o4' },
  { id: 'recCAScs1cSrZff4M', name: 'Venture X Card', fee: 395, bank: 'Capital One', rpId: 'recL2Huh7e9Uh14o4' },
  { id: 'recGqWiKLuLcQjSNU', name: 'VentureOne Card', fee: 0, bank: 'Capital One', rpId: 'recL2Huh7e9Uh14o4' },
  { id: 'recSO40Ib0pI6OJVP', name: 'World of Hyatt Credit Card', fee: 95, bank: 'Chase', rpId: 'reclzb13sunBKONLc' },
  { id: 'recn9RjAn2dENIQE5', name: 'Wyndham Earner Business Card', fee: 95, bank: 'Barclays', rpId: 'reczjUhLxLhxvr5sq' },
  { id: 'reciOo605ZjWKoDqG', name: 'Wyndham Earner Card', fee: 0, bank: 'Barclays', rpId: 'reczjUhLxLhxvr5sq' },
  { id: 'recB1bLzSiSpiCbYh', name: 'Wyndham Earner Plus Card', fee: 75, bank: 'Barclays', rpId: 'reczjUhLxLhxvr5sq' },
];

const REWARDS_PROGRAMS = [
  { id: 'recVYmtytrNTEuNs8', name: 'Aeroplan' },
  { id: 'rec55IJ1WaYQmpeu8', name: 'American Airlines' },
  { id: 'recKOeD2LeTE2umQ2', name: 'Atmos' },
  { id: 'recNtJU89S1XzM2oi', name: 'Autograph Rewards' },
  { id: 'rec76U3fn4IPPgJEX', name: 'Avios' },
  { id: 'recQBrBYWXeCoUDDR', name: 'Best Western' },
  { id: 'recpgINanUGsm06PB', name: 'Bilt' },
  { id: 'recL2Huh7e9Uh14o4', name: 'Capital One Miles' },
  { id: 'recsJ9CLOzTWRVRNm', name: 'Cash Back' },
  { id: 'recgZCguJJSeTkS3T', name: 'Choice' },
  { id: 'recSKJfk2KVcCqRKG', name: 'Hilton' },
  { id: 'reclzb13sunBKONLc', name: 'Hyatt' },
  { id: 'rec5Ey6PfbSqs09WW', name: 'IHG' },
  { id: 'recj0D9sIyA6xLrDK', name: 'KLM' },
  { id: 'recpF7WLSm4xCJ8Sm', name: 'Lifemiles' },
  { id: 'recCrkqmUVPxcvoSR', name: 'Marriott' },
  { id: 'recoRV4OeBwFuxgAC', name: 'Membership Rewards' },
  { id: 'recwN2LICpUqtRyWP', name: 'Southwest' },
  { id: 'recxHZ1Zyd6EHgkcd', name: 'ThankYou Points' },
  { id: 'rec639FwT4wR3st0K', name: 'TrueBlue' },
  { id: 'reckXeIUYBdb6t1mi', name: 'Ultimate Rewards' },
  { id: 'recdOXsN7ckt3EZF0', name: 'United Airlines' },
  { id: 'reczjUhLxLhxvr5sq', name: 'Wyndham Rewards' },
];

// Only these values are valid for the Portfolio Issuer singleSelect field
const VALID_PORTFOLIO_ISSUERS = new Set(['American Express', 'Barclays', 'Capital One', 'Chase', 'Citi']);

const ALL_BANKS = [...new Set(PRODUCTS.map(p => p.bank))].sort();
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const RISK_LEVELS = ['Low', 'Medium', 'High'];

const EMPTY = {
  ownerIds: [], issuer: '', currentProductId: '', cardName: '',
  personalBusiness: 'Personal', openDate: '', annualFee: '',
  annualFeeMonth: '', statementCloseDay: '', last4: '',
  rewardsProgramId: '', cancelRisk: 'Low', status: 'Active',
};

const inp = {
  width: '100%', background: '#0B1220', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '0.6rem 0.75rem', color: '#fff', fontSize: '0.88rem',
  outline: 'none', boxSizing: 'border-box',
};
const lbl = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
};
const card = {
  background: '#172033', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
  padding: '1.25rem 1.5rem',
};
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };

function pillBtn(active, onClick, children) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 18px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)',
      background: active ? '#00D4FF' : 'rgba(255,255,255,0.06)',
      color: active ? '#0B1220' : 'rgba(255,255,255,0.6)',
      fontWeight: active ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

function autoCardName(ownerIds, productId) {
  const nickname = ownerIds.length > 0 ? PEOPLE[ownerIds[0]] : '';
  const product = PRODUCTS.find(p => p.id === productId);
  if (!nickname && !product) return '';
  if (!nickname) return product.name;
  if (!product) return '';
  return `${nickname} - ${product.name}`;
}

export function AddCardTab() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const filteredProducts = form.issuer
    ? PRODUCTS.filter(p => p.bank === form.issuer)
    : [];

  function toggleOwner(id) {
    setForm(prev => {
      const newIds = prev.ownerIds.includes(id)
        ? prev.ownerIds.filter(i => i !== id)
        : [...prev.ownerIds, id];
      return { ...prev, ownerIds: newIds, cardName: autoCardName(newIds, prev.currentProductId) };
    });
  }

  function selectIssuer(bank) {
    const newIssuer = bank === form.issuer ? '' : bank;
    setForm(prev => ({
      ...prev,
      issuer: newIssuer,
      currentProductId: '',
      annualFee: '',
      rewardsProgramId: '',
      cardName: autoCardName(prev.ownerIds, ''),
    }));
  }

  function selectProduct(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    setForm(prev => ({
      ...prev,
      currentProductId: productId,
      annualFee: product ? String(product.fee) : '',
      rewardsProgramId: product?.rpId || '',
      cardName: autoCardName(prev.ownerIds, productId),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.cardName.trim()) { setError('Card Name is required.'); return; }
    if (form.ownerIds.length === 0) { setError('Select at least one Owner.'); return; }

    setSubmitting(true);
    const fields = {
      'Card Name': form.cardName.trim(),
      'Status': form.status,
      'Owner': form.ownerIds,
    };
    if (form.issuer && VALID_PORTFOLIO_ISSUERS.has(form.issuer)) fields['Issuer'] = form.issuer;
    if (form.personalBusiness)   fields['Personal/Business'] = form.personalBusiness;
    if (form.currentProductId)   fields['Current Product'] = [form.currentProductId];
    if (form.openDate)           fields['Open Date'] = form.openDate;
    if (form.annualFee !== '')   fields['Annual Fee Amount'] = parseFloat(form.annualFee);
    if (form.annualFeeMonth)     fields['Annual Fee Post Month'] = parseInt(form.annualFeeMonth);
    if (form.statementCloseDay)  fields['Statement Close Day'] = parseInt(form.statementCloseDay);
    if (form.last4)              fields['Last 4/Last 5 (AMEX)'] = parseInt(form.last4);
    if (form.rewardsProgramId)   fields['Rewards Program'] = [form.rewardsProgramId];
    if (form.cancelRisk)         fields['Cancel Risk Level'] = form.cancelRisk;

    try {
      await createRecord(PORTFOLIO_TABLE, fields);
      setSuccess(true);
      setForm(EMPTY);
      setTimeout(() => setSuccess(false), 5000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 780 }}>

      {success && (
        <div style={{ background: '#00E67622', border: '1px solid #00E676', borderRadius: 10, padding: '0.85rem 1rem', color: '#00E676', fontWeight: 600 }}>
          Card added successfully!
        </div>
      )}
      {error && (
        <div style={{ background: '#FF4D4D22', border: '1px solid #FF4D4D', borderRadius: 10, padding: '0.85rem 1rem', color: '#FF4D4D' }}>
          {error}
        </div>
      )}

      {/* Step 1 — Owner */}
      <div style={card}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
          Owner <span style={{ color: '#FF4D4D' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PEOPLE).map(([id, name]) =>
            pillBtn(form.ownerIds.includes(id), () => toggleOwner(id), name)
          )}
        </div>
      </div>

      {/* Step 2 — Issuer */}
      <div style={card}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>Issuer</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ALL_BANKS.map(bank =>
            pillBtn(form.issuer === bank, () => selectIssuer(bank), bank)
          )}
        </div>
      </div>

      {/* Step 3 — Product (only shown after issuer selected) */}
      {form.issuer && (
        <div style={card}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
            {form.issuer} Card Product
          </div>
          <select style={inp} value={form.currentProductId} onChange={e => selectProduct(e.target.value)}>
            <option value="">— Select product —</option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.fee > 0 ? `($${p.fee})` : '(No AF)'}</option>
            ))}
          </select>
        </div>
      )}

      {/* Card details — shown once product is selected */}
      {form.currentProductId && (
        <>
          {/* Card Name */}
          <div style={card}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.85rem', fontSize: '0.9rem' }}>
              Card Name <span style={{ color: '#FF4D4D' }}>*</span>
            </div>
            <input
              style={inp}
              value={form.cardName}
              onChange={e => setForm(prev => ({ ...prev, cardName: e.target.value }))}
              placeholder="Auto-generated — edit if needed"
            />
          </div>

          {/* Account details */}
          <div style={card}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Account Details</div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Personal / Business</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Personal', 'Business'].map(opt =>
                    pillBtn(form.personalBusiness === opt, () => setForm(p => ({ ...p, personalBusiness: opt })), opt)
                  )}
                </div>
              </div>
              <div>
                <label style={lbl}>Open Date</label>
                <input style={inp} type="date" value={form.openDate} onChange={e => setForm(p => ({ ...p, openDate: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Last 4 Digits (Last 5 for Amex)</label>
                <input style={inp} type="number" value={form.last4} onChange={e => setForm(p => ({ ...p, last4: e.target.value }))} placeholder="1234" />
              </div>
              <div>
                <label style={lbl}>Statement Close Day</label>
                <input style={inp} type="number" value={form.statementCloseDay} onChange={e => setForm(p => ({ ...p, statementCloseDay: e.target.value }))} placeholder="1–31" min={1} max={31} />
              </div>
            </div>
          </div>

          {/* Annual Fee */}
          <div style={card}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Annual Fee</div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Annual Fee Amount ($)</label>
                <input style={inp} type="number" value={form.annualFee} onChange={e => setForm(p => ({ ...p, annualFee: e.target.value }))} placeholder="0" min={0} />
              </div>
              <div>
                <label style={lbl}>Annual Fee Post Month</label>
                <select style={inp} value={form.annualFeeMonth} onChange={e => setForm(p => ({ ...p, annualFeeMonth: e.target.value }))}>
                  <option value="">— Select month —</option>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Rewards & Risk */}
          <div style={card}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '1rem', fontSize: '0.9rem' }}>Rewards & Risk</div>
            <div style={grid2}>
              <div>
                <label style={lbl}>Rewards Program</label>
                <select style={inp} value={form.rewardsProgramId} onChange={e => setForm(p => ({ ...p, rewardsProgramId: e.target.value }))}>
                  <option value="">— None —</option>
                  {REWARDS_PROGRAMS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Cancel Risk Level</label>
                <select style={inp} value={form.cancelRisk} onChange={e => setForm(p => ({ ...p, cancelRisk: e.target.value }))}>
                  {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          <button type="submit" disabled={submitting} style={{
            padding: '0.85rem 2rem', borderRadius: 10, border: 'none',
            background: submitting ? 'rgba(0,212,255,0.4)' : '#00D4FF',
            color: '#0B1220', fontWeight: 700, fontSize: '0.95rem',
            cursor: submitting ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
          }}>
            {submitting ? 'Saving…' : 'Add Card'}
          </button>
        </>
      )}

    </form>
  );
}
