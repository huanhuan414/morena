#!/bin/bash
echo "=== Testing /api/order/open ==="
for i in 1 2 3 4 5; do
  echo -n "Request $i: "
  time curl -s 'http://127.0.0.1:3000/api/order/open?page=1&pageSize=10' -H 'X-User-Id: 385282e1-f733-4fc2-b490-073e6d70d673' > /dev/null 2>&1
done
