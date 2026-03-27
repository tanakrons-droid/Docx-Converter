
const { convert } = require('./src/utils/htmlToGutenbergConverter.js');

const inputHtml = `
<table class="c41"><tbody><tr class="c5"><td class="c38" colspan="1" rowspan="1"><p class="c29"><span class="c19"><a class="c4" href="https://www.google.com/url?q=https://www.vsquareclinic.com/tips/after-botox-pickled-fish/&amp;sa=D&amp;source=editors&amp;ust=1771217868854099&amp;usg=AOvVaw0SJiXtHhB26EQIn06BdJ5z">ฉีดโบท็อกกินปลาร้าได้ไหม ?</a></span></p></td><td class="c38" colspan="1" rowspan="1"><p class="c29"><span class="c19"><a class="c4" href="https://www.google.com/url?q=https://www.vsquareclinic.com/tips/can-you-drink-alcohol-after-botox-injections/&amp;sa=D&amp;source=editors&amp;ust=1771217868854408&amp;usg=AOvVaw3YoCRYD8ebIiuaBPrkKmjJ">ฉีดโบท็อกกินเหล้าได้ไหม ?</a></span></p></td><td class="c38" colspan="1" rowspan="1"><p class="c29"><span class="c19"><a class="c4" href="https://www.google.com/url?q=https://www.vsquareclinic.com/tips/can-you-eat-vitamin-after-botox/&amp;sa=D&amp;source=editors&amp;ust=1771217868854694&amp;usg=AOvVaw21I8Z9NK7fhv3aEfpU4lrB">หลังฉีดโบ กินวิตามินได้ไหม ?</a></span></p></td></tr></tbody></table>
`;

const result = convert(inputHtml, { website: 'vsquareclinic.com' });

console.log("---------------------------------------------------");
console.log("OUTPUT HTML:");
console.log(result.html);
console.log("---------------------------------------------------");
