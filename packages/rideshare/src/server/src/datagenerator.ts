import { stringify, parse } from 'querystring';

import axios from 'axios';

import { ksqlServer } from './index';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// taken from https://github.com/russau/kafka-websockets/blob/master/_experiments/python/velocity.py
// just less good because I think coordinates are the important part
type Payload = {
  centerX: string;
  centerY: string;
  zl: string;
  zv: string;
  fl: string;
  polyline: string;
  elev: string;
  rId: string;
  rdm: string;
  pta: string;
  distance: string;
  // eslint-disable-next-line
  show_name_description: string;
  name: string;
  description: string;
};
const createStatement = `create table cars (id VARCHAR, lat DOUBLE, long DOUBLE) with (KAFKA_TOPIC='cars', VALUE_FORMAT='JSON', key='id', partitions=1, replicas=1);`;
const uniqueCars = `create table unique_cars as select ID, count(*) from cars group by id emit changes;`;

async function generateData(id: string, route: number): Promise<void> {
  try {
    await axios.post(
      `${ksqlServer}ksql`,
      {
        ksql: `${createStatement}${uniqueCars}`,
      },
      { timeout: 1000 }
    );
  } catch (e) {
    if (e.response?.data?.message) {
      // eslint-disable-next-line
      console.error(e.response?.data?.message);
    } else {
      // eslint-disable-next-line
      console.error(e.code);
    }
  }

  const response = await axios.post(
    'https://www.gmap-pedometer.com/gp/ajaxRoute/get',
    stringify({ rId: route })
  );
  const data: Payload = parse(response.data) as Payload;
  const lines = data.polyline.split('a');
  for (let i = 0; i < lines.length; i++) {
    // const payload = { id, lat: parseFloat(lines[i]), long: parseFloat(lines[i + 1]) };
    const command = `insert into cars (id, lat, long) values ('${id}', ${parseFloat(
      lines[i]
    )}, ${parseFloat(lines[i + 1])});`;
    await axios.post(
      `${ksqlServer}ksql`,
      {
        ksql: command,
      },
      { timeout: 1000 }
    );
    // eslint-disable-next-line
    console.log(command);
    await sleep(3000);
    i++;
  }
}

export default async function generate(): Promise<void> {
  generateData('car1', 7428722);
  generateData('car2', 7429821);
  generateData('car3', 7429825);
  generateData('car4', 7430753);
}
