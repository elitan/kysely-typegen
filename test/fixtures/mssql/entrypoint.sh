#!/bin/bash

# Start SQL Server in the background
/opt/mssql/bin/sqlservr &

# Wait for SQL Server to be ready
echo "Waiting for SQL Server to start..."
for i in {1..60}; do
    /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "SELECT 1" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "SQL Server is ready."
        break
    fi
    echo "Waiting... ($i/60)"
    sleep 1
done

# Run init script if it exists and hasn't been run
if [ -f /init.sql ]; then
    if [ ! -f /var/opt/mssql/.initialized ]; then
        echo "Running init script..."
        /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -i /init.sql
        if [ $? -eq 0 ]; then
            touch /var/opt/mssql/.initialized
            echo "Database initialized successfully."
        else
            echo "Failed to initialize database."
        fi
    else
        echo "Database already initialized, skipping."
    fi
fi

# Keep container running
wait
