if [ ! -d "/root/Hydro/" ]; then
	echo "Creating..."
	git clone git@github.com:Henry-Chen0227/Hydro.git /root/Hydro --recursive
	cd /root/Hydro
	yarn
	yarn build:ui:production
	echo "Created."
else
	LOCAL = $(git log)
	REMOTE = $(git log origin/master)
	if [ ! $LOCAL = $REMOTE ]; then
		echo "Updating..."
		cd /root/Hydro
		git pull
		yarn
		yarn build:ui:production
		echo "Updated."
	fi
fi
cd /root/Hydro
pm2 start "ulimit -s unlimited && sandbox" --name sandbox
pm2-runtime start "yarn start --port=8888" --name hydrooj