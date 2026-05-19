-- RPC: seed the default ticker universe for a freshly onboarded user.
-- The web app calls supabase.rpc('seed_default_universe') after first sign-in.

create or replace function public.seed_default_universe()
returns int
language plpgsql
security invoker
as $$
declare
  uid uuid := auth.uid();
  inserted_count int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  with src as (
    select * from (values
      ('AAPL','NASDAQ','Apple Inc.','sp500_top60'),
      ('MSFT','NASDAQ','Microsoft Corp.','sp500_top60'),
      ('NVDA','NASDAQ','NVIDIA Corp.','sp500_top60'),
      ('GOOGL','NASDAQ','Alphabet Inc. (A)','sp500_top60'),
      ('AMZN','NASDAQ','Amazon.com Inc.','sp500_top60'),
      ('META','NASDAQ','Meta Platforms','sp500_top60'),
      ('TSLA','NASDAQ','Tesla Inc.','sp500_top60'),
      ('BRK.B','NYSE','Berkshire Hathaway (B)','sp500_top60'),
      ('AVGO','NASDAQ','Broadcom Inc.','sp500_top60'),
      ('JPM','NYSE','JPMorgan Chase & Co.','sp500_top60'),
      ('V','NYSE','Visa Inc.','sp500_top60'),
      ('UNH','NYSE','UnitedHealth Group','sp500_top60'),
      ('XOM','NYSE','Exxon Mobil Corp.','sp500_top60'),
      ('WMT','NYSE','Walmart Inc.','sp500_top60'),
      ('LLY','NYSE','Eli Lilly & Co.','sp500_top60'),
      ('JNJ','NYSE','Johnson & Johnson','sp500_top60'),
      ('MA','NYSE','Mastercard Inc.','sp500_top60'),
      ('PG','NYSE','Procter & Gamble','sp500_top60'),
      ('ORCL','NYSE','Oracle Corp.','sp500_top60'),
      ('HD','NYSE','Home Depot Inc.','sp500_top60'),
      ('COST','NASDAQ','Costco Wholesale','sp500_top60'),
      ('CVX','NYSE','Chevron Corp.','sp500_top60'),
      ('ABBV','NYSE','AbbVie Inc.','sp500_top60'),
      ('MRK','NYSE','Merck & Co.','sp500_top60'),
      ('BAC','NYSE','Bank of America','sp500_top60'),
      ('KO','NYSE','Coca-Cola Co.','sp500_top60'),
      ('PEP','NASDAQ','PepsiCo Inc.','sp500_top60'),
      ('NFLX','NASDAQ','Netflix Inc.','sp500_top60'),
      ('TMO','NYSE','Thermo Fisher Scientific','sp500_top60'),
      ('ADBE','NASDAQ','Adobe Inc.','sp500_top60'),
      ('ABT','NYSE','Abbott Laboratories','sp500_top60'),
      ('CRM','NYSE','Salesforce Inc.','sp500_top60'),
      ('DIS','NYSE','Walt Disney Co.','sp500_top60'),
      ('CSCO','NASDAQ','Cisco Systems','sp500_top60'),
      ('MCD','NYSE','McDonald''s Corp.','sp500_top60'),
      ('ACN','NYSE','Accenture plc','sp500_top60'),
      ('WFC','NYSE','Wells Fargo & Co.','sp500_top60'),
      ('INTC','NASDAQ','Intel Corp.','sp500_top60'),
      ('TMUS','NASDAQ','T-Mobile US','sp500_top60'),
      ('LIN','NYSE','Linde plc','sp500_top60'),
      ('DHR','NYSE','Danaher Corp.','sp500_top60'),
      ('AMD','NASDAQ','Advanced Micro Devices','sp500_top60'),
      ('TXN','NASDAQ','Texas Instruments','sp500_top60'),
      ('PFE','NYSE','Pfizer Inc.','sp500_top60'),
      ('UNP','NYSE','Union Pacific Corp.','sp500_top60'),
      ('IBM','NYSE','IBM Corp.','sp500_top60'),
      ('CAT','NYSE','Caterpillar Inc.','sp500_top60'),
      ('QCOM','NASDAQ','Qualcomm Inc.','sp500_top60'),
      ('BA','NYSE','Boeing Co.','sp500_top60'),
      ('HON','NASDAQ','Honeywell International','sp500_top60'),
      ('GS','NYSE','Goldman Sachs Group','sp500_top60'),
      ('NKE','NYSE','Nike Inc.','sp500_top60'),
      ('GE','NYSE','GE Aerospace','sp500_top60'),
      ('PYPL','NASDAQ','PayPal Holdings','sp500_top60'),
      ('BLK','NYSE','BlackRock Inc.','sp500_top60'),
      ('SBUX','NASDAQ','Starbucks Corp.','sp500_top60'),
      ('AMAT','NASDAQ','Applied Materials','sp500_top60'),
      ('NOW','NYSE','ServiceNow Inc.','sp500_top60'),
      ('AXP','NYSE','American Express Co.','sp500_top60'),
      ('PLTR','NYSE','Palantir Technologies','sp500_top60'),
      ('BKNG','NASDAQ','Booking Holdings','sp500_top60'),
      ('SAP.DE','XETRA','SAP SE','dax40'),
      ('SIE.DE','XETRA','Siemens AG','dax40'),
      ('ALV.DE','XETRA','Allianz SE','dax40'),
      ('DTE.DE','XETRA','Deutsche Telekom AG','dax40'),
      ('MUV2.DE','XETRA','Munich Re','dax40'),
      ('AIR.DE','XETRA','Airbus SE','dax40'),
      ('BAS.DE','XETRA','BASF SE','dax40'),
      ('BMW.DE','XETRA','BMW AG','dax40'),
      ('MBG.DE','XETRA','Mercedes-Benz Group','dax40'),
      ('VOW3.DE','XETRA','Volkswagen AG (Pref)','dax40'),
      ('DBK.DE','XETRA','Deutsche Bank AG','dax40'),
      ('DB1.DE','XETRA','Deutsche Boerse AG','dax40'),
      ('BAYN.DE','XETRA','Bayer AG','dax40'),
      ('IFX.DE','XETRA','Infineon Technologies','dax40'),
      ('ADS.DE','XETRA','Adidas AG','dax40'),
      ('EOAN.DE','XETRA','E.ON SE','dax40'),
      ('RWE.DE','XETRA','RWE AG','dax40'),
      ('HEN3.DE','XETRA','Henkel AG (Pref)','dax40'),
      ('MRK.DE','XETRA','Merck KGaA','dax40'),
      ('LIN.DE','XETRA','Linde plc','dax40'),
      ('FRE.DE','XETRA','Fresenius SE','dax40'),
      ('CBK.DE','XETRA','Commerzbank AG','dax40'),
      ('PAH3.DE','XETRA','Porsche SE','dax40'),
      ('P911.DE','XETRA','Porsche AG','dax40'),
      ('BEI.DE','XETRA','Beiersdorf AG','dax40'),
      ('CON.DE','XETRA','Continental AG','dax40'),
      ('HEI.DE','XETRA','Heidelberg Materials','dax40'),
      ('MTX.DE','XETRA','MTU Aero Engines','dax40'),
      ('QIA.DE','XETRA','Qiagen N.V.','dax40'),
      ('RHM.DE','XETRA','Rheinmetall AG','dax40'),
      ('SHL.DE','XETRA','Siemens Healthineers','dax40'),
      ('ENR.DE','XETRA','Siemens Energy','dax40'),
      ('SY1.DE','XETRA','Symrise AG','dax40'),
      ('VNA.DE','XETRA','Vonovia SE','dax40'),
      ('ZAL.DE','XETRA','Zalando SE','dax40'),
      ('HNR1.DE','XETRA','Hannover Rueck SE','dax40'),
      ('DTG.DE','XETRA','Daimler Truck Holding','dax40'),
      ('SRT3.DE','XETRA','Sartorius AG (Pref)','dax40'),
      ('BNR.DE','XETRA','Brenntag SE','dax40')
    ) as t(symbol, exchange, name, group_tag)
  )
  insert into public.tickers (user_id, symbol, exchange, name, group_tag, active)
  select uid, symbol, exchange, name, group_tag, true from src
  on conflict (user_id, symbol) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.seed_default_universe() to authenticated;
