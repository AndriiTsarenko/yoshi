describe.skip('React application', () => {
  it('should display title', async () => {
    await page.goto('https://localhost:3100/editorExampleWidget');

    expect(await page.$eval('h2', e => e.innerText)).toEqual('Hello World!');
  });
});

//todo check (window as any)
