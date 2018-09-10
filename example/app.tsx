import * as React from 'react';
import {Component} from 'react';
import {GHCorner} from 'react-gh-corner';
import {AppWrapper} from './styled';
import {limited} from "../src";

export interface AppState {

}

const repoUrl = 'https://github.com/zzarcon/';

const timedPromise = (tm: number): Promise<any> => new Promise(resolve => setTimeout(resolve, tm));

const test = async () => {
  const limit = limited(10);
  let maxConcurent = 0;
  let current = 0;
  let passed = 0;

  const promises = Array(100).fill(1).map(() => (
    limit(async () => {
      current++;
      maxConcurent = Math.max(maxConcurent, current);
      console.log(maxConcurent, current);

      await timedPromise(Math.random() * 50);

      current--;

      passed++;
      if(passed>50){
        limit.close();
      }
    })
  ));

  await Promise.all(promises);

  console.log(promises);
  console.log('>>', current, maxConcurent);
};

test();


export default class App extends Component <{}, AppState> {
  state: AppState = {}

  render() {
    return (
      <AppWrapper>
        <GHCorner openInNewTab href={repoUrl}/>
        Example!
      </AppWrapper>
    )
  }
}