SELECT o.id, o.status, o.title, o.created_at, o.publisher_id
FROM orders o 
WHERE o.id = 'ec23ded7-f6fb-4e03-8e5b-0d94ade24e74';

SELECT r.*, o.status as order_status
FROM order_dispatch_requests r
LEFT JOIN orders o ON r.order_id = o.id
WHERE r.id = '2af2006e-8cb7-4522-886b-a40f8251f866';
