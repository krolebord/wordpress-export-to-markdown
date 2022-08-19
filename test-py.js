import {PythonShell} from 'python-shell';
let pyshell = new PythonShell('detect-lang.py');

pyshell.send('hello');

pyshell.on('message', function (message) {
  console.log(message);
});

pyshell.end(function (err, code) {
  if (err) throw err;
  console.log('The exit code was: ' + code);
  console.log('finished');
});
