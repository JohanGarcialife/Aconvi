const { spawn } = require('child_process');

const child = spawn('npx', ['drizzle-kit', 'push'], {
  env: process.env,
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  if (output.includes('Is avg_days_to_resolve column')) {
    child.stdin.write('\n');
  }
  if (output.includes('Is price_range_min column')) {
    child.stdin.write('\n');
  }
  if (output.includes('Is price_range_max column')) {
    child.stdin.write('\n');
  }
  if (output.includes('Is is_trusted column')) {
    child.stdin.write('\n');
  }
  if (output.includes('Is rating column')) {
    child.stdin.write('\n');
  }
  if (output.includes('Is speciality column')) {
    child.stdin.write('\n');
  }
  if (output.includes('create column')) {
    child.stdin.write('\n');
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
